-- ============================================================
-- Migration 082: Revenue kelas - cash baru dihitung kalau hadir
-- Sebelumnya revenue_class (get_class_occupancy & get_laporan_revenue)
-- menghitung SEMUA registrasi kelas yang confirmed_at-nya terisi, tanpa
-- bedakan metode bayar. Untuk metode 'cash' (bayar di tempat),
-- confirmed_at di-set OTOMATIS saat booking (lihat
-- create_class_registration RPC, migration 047) - BUKAN saat uangnya
-- benar-benar diterima. Akibatnya orang yang booking-cash lalu TIDAK
-- hadir tetap terhitung sebagai revenue, padahal uangnya tidak pernah
-- berpindah tangan.
--
-- 'transfer' TIDAK diubah - confirmed_at untuk transfer baru di-set
-- setelah instruktur verifikasi bukti bayar, jadi uangnya memang sudah
-- diterima saat itu, terlepas dari kehadiran nanti (revenue yang sah).
--
-- Kehadiran dicek via korelasi ke tabel attendance (BUKAN kolom
-- registrations.attended - kolom itu cuma terisi untuk Event lewat
-- toggle manual terpisah, tidak pernah di-set untuk kelas), dicocokkan
-- per sesi (class_id + session_date registrasi → sessions.id) dan
-- identitas peserta (member_id kalau ada, kalau tidak nama+telepon -
-- nomor HP saja tidak cukup karena bisa dipakai >1 orang/keluarga).
--
-- Scope sengaja HANYA kelas (revenue_event tidak disentuh) sesuai
-- kesepakatan - payment_method_breakdown di get_laporan_revenue juga
-- belum disesuaikan (gabungan kelas+event, perlu keputusan terpisah
-- kalau mau dikoreksi juga).
-- ============================================================

CREATE OR REPLACE FUNCTION get_class_occupancy(
  p_user_id      UUID,
  p_period_start DATE,
  p_period_end   DATE
)
RETURNS JSON
LANGUAGE sql
STABLE
AS $$
  SELECT COALESCE(json_agg(row_to_json(t)), '[]'::json)
  FROM (
    SELECT
      c.id,
      c.name,
      c.capacity,
      COALESCE(s.session_count, 0)    AS session_count,
      COALESCE(a.attendance_count, 0) AS attendance_count,
      COALESCE(r.revenue, 0)          AS revenue
    FROM classes c
    LEFT JOIN (
      SELECT class_id, count(*) AS session_count
      FROM sessions
      WHERE user_id = p_user_id
        AND session_date >= p_period_start AND session_date <= p_period_end
      GROUP BY class_id
    ) s ON s.class_id = c.id
    LEFT JOIN (
      SELECT sess.class_id, count(att.id) AS attendance_count
      FROM sessions sess
      JOIN attendance att ON att.session_id = sess.id
      WHERE sess.user_id = p_user_id
        AND sess.session_date >= p_period_start AND sess.session_date <= p_period_end
      GROUP BY sess.class_id
    ) a ON a.class_id = c.id
    LEFT JOIN (
      SELECT reg.class_id, sum(reg.amount_paid) AS revenue
      FROM registrations reg
      WHERE reg.user_id = p_user_id AND reg.class_id IS NOT NULL
        AND reg.confirmed_at IS NOT NULL
        AND reg.confirmed_at >= p_period_start AND reg.confirmed_at < (p_period_end + 1)
        AND (
          reg.payment_method IS DISTINCT FROM 'cash'
          OR EXISTS (
            SELECT 1 FROM attendance att
            JOIN sessions sess ON sess.id = att.session_id
            WHERE sess.class_id = reg.class_id
              AND sess.session_date = reg.session_date
              AND (
                (reg.member_id IS NOT NULL AND att.member_id = reg.member_id)
                OR (reg.member_id IS NULL AND att.registrant_phone = reg.registrant_phone AND att.registrant_name = reg.registrant_name)
              )
          )
        )
      GROUP BY reg.class_id
    ) r ON r.class_id = c.id
    WHERE c.user_id = p_user_id AND c.is_active = true
    ORDER BY c.name
  ) t;
$$;

CREATE OR REPLACE FUNCTION get_laporan_revenue(
  p_user_id      UUID,
  p_period_start DATE,
  p_period_end   DATE
)
RETURNS JSON
LANGUAGE sql
STABLE
AS $$
  SELECT json_build_object(
    'revenue_event', COALESCE((
      SELECT sum(amount_paid) FROM registrations
      WHERE user_id = p_user_id AND event_id IS NOT NULL
        AND confirmed_at IS NOT NULL
        AND confirmed_at >= p_period_start AND confirmed_at < (p_period_end + 1)
    ), 0),
    'revenue_class', COALESCE((
      SELECT sum(reg.amount_paid) FROM registrations reg
      WHERE reg.user_id = p_user_id AND reg.class_id IS NOT NULL
        AND reg.confirmed_at IS NOT NULL
        AND reg.confirmed_at >= p_period_start AND reg.confirmed_at < (p_period_end + 1)
        AND (
          reg.payment_method IS DISTINCT FROM 'cash'
          OR EXISTS (
            SELECT 1 FROM attendance att
            JOIN sessions sess ON sess.id = att.session_id
            WHERE sess.class_id = reg.class_id
              AND sess.session_date = reg.session_date
              AND (
                (reg.member_id IS NOT NULL AND att.member_id = reg.member_id)
                OR (reg.member_id IS NULL AND att.registrant_phone = reg.registrant_phone AND att.registrant_name = reg.registrant_name)
              )
          )
        )
    ), 0),
    'revenue_membership_gross', COALESCE((
      SELECT sum(purchase_price) FROM member_memberships
      WHERE user_id = p_user_id AND purchase_price > 0
        AND created_at >= p_period_start AND created_at < (p_period_end + 1)
        AND source = 'fitflow'
    ), 0),
    'revenue_membership_refund', COALESCE((
      SELECT sum(refund_amount) FROM member_memberships
      WHERE user_id = p_user_id
        AND refunded_at >= p_period_start AND refunded_at < (p_period_end + 1)
        AND source = 'fitflow'
    ), 0),
    'revenue_walkin', COALESCE((
      SELECT sum(amount_paid) FROM attendance
      WHERE user_id = p_user_id AND source = 'walkin'
        AND created_at >= p_period_start AND created_at < (p_period_end + 1)
    ), 0),
    'pending_count', (
      SELECT count(*) FROM registrations
      WHERE user_id = p_user_id AND payment_status = 'pending'
    ),
    'pending_amount', COALESCE((
      SELECT sum(amount_paid) FROM registrations
      WHERE user_id = p_user_id AND payment_status = 'pending'
    ), 0),
    'payment_method_breakdown', (
      SELECT COALESCE(json_object_agg(method, total), '{}'::json) FROM (
        SELECT COALESCE(payment_method::text, 'lainnya') AS method, sum(amount_paid) AS total
        FROM (
          SELECT payment_method, amount_paid FROM registrations
          WHERE user_id = p_user_id AND confirmed_at IS NOT NULL
            AND confirmed_at >= p_period_start AND confirmed_at < (p_period_end + 1)
          UNION ALL
          SELECT payment_method, amount_paid FROM attendance
          WHERE user_id = p_user_id AND source = 'walkin'
            AND created_at >= p_period_start AND created_at < (p_period_end + 1)
        ) combined
        GROUP BY COALESCE(payment_method::text, 'lainnya')
      ) grouped
    )
  );
$$;
