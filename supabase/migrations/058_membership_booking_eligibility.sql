-- ─────────────────────────────────────────────────────────────────
-- 058_membership_booking_eligibility.sql
-- Sprint Membership Booking - gap ditemukan langsung saat uji coba
-- landing page: member yang SUDAH bayar paket (member_memberships)
-- tetap diarahkan ke alur transfer/cash ketika daftar kelas sendiri
-- via /[slug]/daftar/kelas/[classId], karena create_class_registration
-- (047) tidak punya konsep membership sama sekali - registrant_phone
-- cuma dicatat, tidak pernah dicocokkan ke `members`.
--
-- Keputusan produk (locked): konsumsi sesi TETAP terjadi di attendance
-- (trigger 057), TIDAK di booking ini - booking cuma menentukan apakah
-- peserta perlu bayar atau tidak. "Booking" yang dimaksud secara
-- struktural adalah baris `registrations` yang sudah ada; tidak ada
-- tabel/kolom baru.
--
-- Dua helper di bawah dipakai oleh DUA RPC (check_membership_eligibility
-- untuk live-check di form publik, create_class_registration untuk
-- otorisasi final) supaya predikat eligibility cuma hidup di satu
-- tempat - bukan disalin dua kali.
--
-- Eligibility meniru predikat yang sudah dipakai trigger konsumsi
-- (057): membership 'active', class_type cocok (NULL paket = berlaku
-- semua tipe), dan untuk session_pack sisa sesi > 0. 'unlimited' tidak
-- pernah dicek sisa sesi (sama seperti trigger 057 - cuma session_pack
-- yang punya konsep "habis").
-- ─────────────────────────────────────────────────────────────────

-- ── find_member_by_phone ────────────────────────────────────────────
-- Pencocokan nomor HP dengan dua varian (lokal 0xxx / internasional
-- 62xxx) - pola yang sama dipakai di src/app/api/wa/incoming/route.ts
-- untuk mengenali pengirim WA, supaya konsisten dengan format apa pun
-- yang instruktur ketik manual di form member.
CREATE OR REPLACE FUNCTION find_member_by_phone(p_user_id UUID, p_phone TEXT)
RETURNS UUID
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_digits  TEXT;
  v_local   TEXT;
  v_intl    TEXT;
  v_member_id UUID;
BEGIN
  v_digits := regexp_replace(p_phone, '\D', '', 'g');
  IF v_digits = '' THEN
    RETURN NULL;
  END IF;

  v_local := CASE WHEN left(v_digits, 2) = '62' THEN '0' || substring(v_digits FROM 3) ELSE v_digits END;
  v_intl  := CASE WHEN left(v_digits, 1) = '0'  THEN '62' || substring(v_digits FROM 2) ELSE v_digits END;

  SELECT id INTO v_member_id
  FROM members
  WHERE user_id = p_user_id AND phone IN (v_local, v_intl)
  LIMIT 1;

  RETURN v_member_id;
END;
$$;

-- ── member_membership_eligible ──────────────────────────────────────
-- True kalau member punya membership aktif yang berlaku untuk
-- p_class_type pada p_session_date (bukan CURRENT_DATE - booking bisa
-- untuk kelas beberapa hari ke depan) dan, untuk session_pack, masih
-- ada sisa sesi.
CREATE OR REPLACE FUNCTION member_membership_eligible(p_member_id UUID, p_class_type class_type, p_session_date DATE)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_membership RECORD;
  v_remaining  INT;
BEGIN
  IF p_member_id IS NULL THEN
    RETURN FALSE;
  END IF;

  SELECT mm.* INTO v_membership
  FROM member_memberships mm
  JOIN membership_packages mp ON mp.id = mm.package_id
  WHERE mm.member_id = p_member_id
    AND mm.status = 'active'
    AND mm.start_date <= p_session_date
    AND (mm.end_date IS NULL OR mm.end_date >= p_session_date)
    AND (mp.class_type IS NULL OR mp.class_type = p_class_type)
  LIMIT 1;

  IF v_membership.id IS NULL THEN
    RETURN FALSE;
  END IF;

  IF v_membership.package_type = 'unlimited' THEN
    RETURN TRUE;
  END IF;

  IF v_membership.package_type = 'session_pack' THEN
    SELECT v_membership.total_sessions - count(*) INTO v_remaining
    FROM membership_consumptions
    WHERE membership_id = v_membership.id AND reversed_at IS NULL;

    RETURN v_remaining > 0;
  END IF;

  RETURN FALSE;
END;
$$;

-- Helper internal - bukan untuk dipanggil langsung dari klien anon
-- (find_member_by_phone mengembalikan member_id mentah, bukan boolean
-- seperti check_membership_eligibility). PostgREST mengekspos semua
-- fungsi public secara default kalau tidak di-REVOKE - panggilan
-- internal dari RPC SECURITY DEFINER lain tetap jalan normal karena
-- privilese dicek terhadap pemilik fungsi, bukan caller asli.
REVOKE EXECUTE ON FUNCTION find_member_by_phone(UUID, TEXT) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION member_membership_eligible(UUID, class_type, DATE) FROM PUBLIC;

-- ── check_membership_eligibility ────────────────────────────────────
-- RPC publik read-only dipanggil form landing page saat blur nomor HP,
-- untuk menentukan apakah bagian pembayaran perlu ditampilkan. Hanya
-- mengembalikan boolean - tidak ada data member yang dibocorkan ke
-- klien anon manapun.
CREATE OR REPLACE FUNCTION check_membership_eligibility(
  p_class_id        UUID,
  p_session_date    DATE,
  p_registrant_phone TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  cls RECORD;
  v_member_id UUID;
BEGIN
  SELECT user_id, type INTO cls FROM classes WHERE id = p_class_id AND is_active = true;
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  v_member_id := find_member_by_phone(cls.user_id, p_registrant_phone);
  RETURN member_membership_eligible(v_member_id, cls.type, p_session_date);
END;
$$;

-- ── create_class_registration (047) ─────────────────────────────────
-- Sama seperti sebelumnya (capacity lock, dedup, pricing server-side),
-- ditambah: cocokkan registrant_phone ke member, dan kalau eligible,
-- bebaskan dari pembayaran (member_id di-set, payment_status langsung
-- 'confirmed', amount_paid=0, payment_method=NULL - revenue paket
-- sudah dicatat saat pembelian member_memberships, BUKAN per kunjungan,
-- jadi amount_paid=0 di sini menghindari double-count, konsisten
-- dengan aturan Revenue Settlement).
--
-- Kalau nomor cocok ke member TAPI tidak eligible untuk kelas ini
-- (class_type tidak cocok / sesi habis), member_id TETAP di-set (biar
-- badge "Member" di dashboard instruktur akurat) tapi alur pembayaran
-- tetap OTS seperti biasa - bukan diblokir, cuma tidak gratis.
--
-- Client TIDAK PERNAH mengirim "saya member" - status eligibility
-- selalu dihitung ulang di server dari registrant_phone, tidak bisa
-- dipalsukan dari browser (prinsip yang sama dengan "browser tidak
-- boleh menentukan harga" di 047 asli).
--
-- Return type berubah dari UUID polos jadi TABLE(id, payment_status,
-- used_membership) supaya form tahu pasti hasil keputusan server
-- (bukan menebak dari guess sebelum submit) untuk pesan sukses yang
-- tepat. Postgres tidak bisa CREATE OR REPLACE lintas return type -
-- harus DROP dulu.
DROP FUNCTION IF EXISTS create_class_registration(UUID, DATE, TEXT, TEXT, payment_method, TEXT);

CREATE FUNCTION create_class_registration(
  p_class_id          UUID,
  p_session_date       DATE,
  p_registrant_name    TEXT,
  p_registrant_phone   TEXT,
  p_payment_method     payment_method DEFAULT NULL,
  p_proof_url           TEXT DEFAULT NULL
)
RETURNS TABLE(id UUID, payment_status payment_status, used_membership BOOLEAN)
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  cls               RECORD;
  v_existing_id     UUID;
  v_existing_status payment_status;
  v_total_used      INT;
  v_is_free         BOOLEAN;
  v_payment_status  payment_status;
  v_amount          NUMERIC;
  v_registration_id UUID;
  v_member_id       UUID;
  v_used_membership BOOLEAN := FALSE;
BEGIN
  IF p_registrant_name IS NULL OR length(trim(p_registrant_name)) = 0 THEN
    RAISE EXCEPTION 'registrant_name_required';
  END IF;
  IF p_registrant_phone IS NULL OR length(trim(p_registrant_phone)) = 0 THEN
    RAISE EXCEPTION 'registrant_phone_required';
  END IF;

  SELECT * INTO cls FROM classes WHERE id = p_class_id AND is_active = true FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'class_not_found';
  END IF;

  -- Idempotency: identik dengan registrant yang sudah punya booking
  -- aktif untuk class+date ini - kembalikan baris itu, jangan duplikat.
  SELECT r.id, r.payment_status INTO v_existing_id, v_existing_status FROM registrations r
    WHERE r.class_id = p_class_id
      AND r.session_date = p_session_date
      AND r.registrant_phone = trim(p_registrant_phone)
      AND lower(r.registrant_name) = lower(trim(p_registrant_name))
      AND r.payment_status IN ('pending', 'confirmed')
    LIMIT 1;

  IF v_existing_id IS NOT NULL THEN
    RETURN QUERY SELECT v_existing_id, v_existing_status, FALSE;
    RETURN;
  END IF;

  v_total_used := (
    SELECT COUNT(*) FROM registrations
    WHERE class_id = p_class_id AND session_date = p_session_date
      AND payment_status IN ('pending', 'confirmed')
  );

  IF cls.capacity IS NOT NULL AND v_total_used >= cls.capacity THEN
    RAISE EXCEPTION 'class_full';
  END IF;

  v_member_id := find_member_by_phone(cls.user_id, p_registrant_phone);
  v_is_free   := COALESCE(cls.class_price, 0) <= 0;

  IF NOT v_is_free AND member_membership_eligible(v_member_id, cls.type, p_session_date) THEN
    v_used_membership := TRUE;
    v_amount          := 0;
    v_payment_status  := 'confirmed'::payment_status;
  ELSE
    v_amount  := CASE WHEN v_is_free THEN 0 ELSE cls.class_price END;
    v_payment_status := CASE
      WHEN v_is_free THEN 'confirmed'::payment_status
      WHEN p_payment_method = 'cash' THEN 'confirmed'::payment_status
      ELSE 'pending'::payment_status
    END;
  END IF;

  INSERT INTO registrations (
    class_id, session_date, user_id, registrant_name, registrant_phone,
    member_id, tier, amount_paid, payment_method, payment_status, proof_url
  )
  VALUES (
    p_class_id, p_session_date, cls.user_id, trim(p_registrant_name), trim(p_registrant_phone),
    v_member_id, 'ots', v_amount,
    CASE WHEN v_is_free OR v_used_membership THEN NULL ELSE p_payment_method END,
    v_payment_status, p_proof_url
  )
  RETURNING registrations.id INTO v_registration_id;

  RETURN QUERY SELECT v_registration_id, v_payment_status, v_used_membership;
END;
$$;
