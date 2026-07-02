-- ─────────────────────────────────────────────────────────────────
-- 079_platform_admin_funnel_health.sql
-- Platform Admin V1, Sprint 1: instructor_funnel_status + instructor_health_tier.
--
-- Sama pola dengan compute_business_activity_status()/member_summary
-- (migrasi 068-071) - dihitung murni saat dibaca lewat VIEW, tidak ada
-- storage baru, tidak ada trigger, tidak ada cron. Definisi dikunci di:
--   docs/PLATFORM_ADMIN_V1_FINAL_DESIGN.md
--   docs/CUSTOMER_SUCCESS_FUNNEL_CRITICAL_REVIEW.md   (arsitektur 3-jalur)
--   docs/ACTIVATION_DEFINITION_REVIEW_MEMBERSHIP_SALE.md (Aktivasi = Attendance saja)
--   docs/PLATFORM_ADMIN_V1_PRE_IMPLEMENTATION_REVIEW.md  (broadcast DIKECUALIKAN dari Health)
--   docs/PLATFORM_ADMIN_V1_IMPLEMENTATION_PLAN.md        (rencana build ini)
--
-- Catatan implementasi (bukan keputusan desain baru, murni resolusi teknis
-- saat menulis SQL): Health Tier secara ketat HANYA mencakup instruktur
-- yang sudah Activated (WHERE f.is_activated), konsisten dengan aturan
-- serah-terima funnel<->health yang sudah dikunci di seluruh dokumen di
-- atas. Klausa "trial habis >30 hari tanpa pernah Aktivasi" yang sempat
-- disebut di draf awal Health Tier secara logis adalah kondisi PRA-Aktivasi
-- (punya jawabannya di instructor_funnel_status.stage + profiles.trial_expires_at,
-- dipakai alert "Trial habis, belum Activated" yang sudah terpisah) - bukan
-- dihitung ulang di sini, supaya tidak ada dua tempat menjawab pertanyaan
-- yang sama dengan cara berbeda.
-- ─────────────────────────────────────────────────────────────────

-- ── Index pendukung - murni performa, tidak mengubah perilaku apa pun.
--    Mencegah view di bawah jadi sequential scan per profil begitu jumlah
--    instruktur tumbuh (risiko yang sudah ditandai eksplisit di review
--    sebelumnya: "Query Health/Stage dihitung per-baris... Sedang->Tinggi"). ──
CREATE INDEX IF NOT EXISTS idx_attendance_user_id            ON attendance(user_id);
CREATE INDEX IF NOT EXISTS idx_attendance_member_id          ON attendance(member_id);
CREATE INDEX IF NOT EXISTS idx_registrations_user_id         ON registrations(user_id);
CREATE INDEX IF NOT EXISTS idx_registrations_user_attended   ON registrations(user_id, attended);
CREATE INDEX IF NOT EXISTS idx_classes_user_id                ON classes(user_id);
CREATE INDEX IF NOT EXISTS idx_classes_user_show_reg          ON classes(user_id, show_registrations);
CREATE INDEX IF NOT EXISTS idx_events_user_id                 ON events(user_id);
CREATE INDEX IF NOT EXISTS idx_events_user_status              ON events(user_id, status);
CREATE INDEX IF NOT EXISTS idx_member_memberships_member_status ON member_memberships(member_id, status);
CREATE INDEX IF NOT EXISTS idx_sessions_class_created          ON sessions(class_id, created_at);

-- ─────────────────────────────────────────────────────────────────
-- 1. instructor_funnel_status
--    M0-M5, arsitektur 3-jalur, bucket "Membership Awaiting Attendance"
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW instructor_funnel_status AS
SELECT
  p.id                                                              AS user_id,
  p.business_name,
  p.slug,
  p.created_at                                                      AS m0_confirmed_at,
  (p.slug IS NOT NULL)                                              AS m1_identity_complete,
  (content.has_class OR content.has_event)                         AS m2_content_created,
  (content.has_published_class OR content.has_published_event)     AS m3_published,
  (reg.registration_count > 0)                                     AS m4_registration_received,
  act.activated_at,
  (act.activated_at IS NOT NULL)                                   AS is_activated,
  CASE
    WHEN content.has_class AND content.has_event THEN 'mixed'
    WHEN content.has_class                       THEN 'class_led'
    WHEN content.has_event                       THEN 'event_led'
    ELSE NULL
  END                                                                AS content_type,
  (content.has_published_class OR content.has_published_event OR reg.registration_count > 0)
                                                                     AS path_a_started,
  COALESCE(mem.awaiting_count, 0)                                   AS membership_awaiting_count,
  COALESCE(mem.awaiting_overdue_count, 0)                           AS membership_awaiting_overdue_count,
  CASE
    WHEN act.activated_at IS NOT NULL THEN 'activated'
    WHEN p.slug IS NULL THEN 'signup'
    WHEN NOT (content.has_class OR content.has_event) THEN 'setup'
    WHEN content.has_class
         AND NOT content.has_published_class
         AND NOT content.has_event
         AND reg.registration_count = 0
         AND content.has_recently_tended_unpublished_class
      THEN 'go_live'
    ELSE 'first_traction'
  END                                                                AS stage
FROM profiles p
LEFT JOIN LATERAL (
  SELECT
    EXISTS (SELECT 1 FROM classes c WHERE c.user_id = p.id)                              AS has_class,
    EXISTS (SELECT 1 FROM events e  WHERE e.user_id = p.id)                              AS has_event,
    EXISTS (SELECT 1 FROM classes c WHERE c.user_id = p.id AND c.show_registrations)     AS has_published_class,
    EXISTS (SELECT 1 FROM events e  WHERE e.user_id = p.id AND e.status = 'published')   AS has_published_event,
    EXISTS (
      SELECT 1 FROM classes c
      WHERE c.user_id = p.id AND NOT c.show_registrations
        AND (
          c.updated_at > NOW() - INTERVAL '7 days'
          OR EXISTS (
            SELECT 1 FROM sessions s
            WHERE s.class_id = c.id AND s.created_at > NOW() - INTERVAL '7 days'
          )
        )
    )                                                                                     AS has_recently_tended_unpublished_class
) content ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS registration_count
  FROM registrations r WHERE r.user_id = p.id
) reg ON true
LEFT JOIN LATERAL (
  -- Aktivasi = Attendance saja (keputusan terkunci). Dua sumber yang sah:
  -- (a) attendance langsung (Jalur B/C, dan Jalur A setelah registrant jadi member)
  -- (b) registrations.attended=true (Jalur A, berlaku utk class & event registrations
  --     sejak satu tabel yang sama dipakai keduanya - tidak butuh member_id terisi)
  --
  -- Sumber (b) SENGAJA dipakai, bukan oversight: tabel attendance mewajibkan
  -- member_id NOT NULL, padahal peserta Jalur A (terutama event sekali-datang)
  -- sering TIDAK PERNAH dikonversi jadi member. Tanpa sumber (b), instruktur
  -- event-led yang sukses penuh tidak akan pernah tercatat Activated. Lihat
  -- docs/PLATFORM_ADMIN_V1_IMPLEMENTATION_PLAN.md Part F (Item 1, KEEP).
  SELECT MIN(activity_at) AS activated_at
  FROM (
    SELECT a.created_at AS activity_at
    FROM attendance a WHERE a.user_id = p.id
    UNION ALL
    SELECT COALESCE(r.session_date::timestamptz, ev.event_date::timestamptz) AS activity_at
    FROM registrations r
    LEFT JOIN events ev ON ev.id = r.event_id
    WHERE r.user_id = p.id AND r.attended = true
  ) combined
) act ON true
LEFT JOIN LATERAL (
  SELECT
    COUNT(*)                                                          AS awaiting_count,
    COUNT(*) FILTER (WHERE mm.created_at < NOW() - INTERVAL '14 days') AS awaiting_overdue_count
  FROM member_memberships mm
  JOIN members m ON m.id = mm.member_id
  WHERE m.user_id = p.id
    AND mm.status = 'active'
    AND NOT EXISTS (SELECT 1 FROM attendance a WHERE a.member_id = mm.member_id)
) mem ON true;

COMMENT ON VIEW instructor_funnel_status IS
  'Platform Admin V1: M0-M5 path-aware funnel stage per instruktur. Dihitung murni saat dibaca, tidak ada storage. Lihat docs/PLATFORM_ADMIN_V1_FINAL_DESIGN.md.';

-- ─────────────────────────────────────────────────────────────────
-- 2. instructor_health_tier
--    4 tier (Healthy/Needs Attention/At Risk/Inactive), broadcast
--    DIKECUALIKAN, HANYA untuk instruktur yang sudah Activated.
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW instructor_health_tier AS
SELECT
  f.user_id,
  f.activated_at,
  recency.last_operational_activity_at,
  classes_active.active_class_count,
  wa.wa_ever_connected,
  wa.wa_previously_connected,
  p.subscription_status,
  p.trial_expires_at,
  CASE GREATEST(
    -- 0=healthy 1=needs_attention 2=at_risk 3=inactive - tiap kondisi
    -- dievaluasi independen (OR semantik dari desain terkunci), tier
    -- akhir = paling parah di antara semua kondisi yang match.
    CASE
      WHEN recency.last_operational_activity_at IS NULL THEN 3
      WHEN recency.last_operational_activity_at > NOW() - INTERVAL '14 days' THEN 0
      WHEN recency.last_operational_activity_at > NOW() - INTERVAL '30 days' THEN 1
      WHEN recency.last_operational_activity_at > NOW() - INTERVAL '60 days' THEN 2
      ELSE 3
    END,
    CASE
      WHEN wa.wa_ever_connected AND NOT wa.wa_previously_connected THEN 1
      ELSE 0
    END,
    CASE
      WHEN classes_active.active_class_count = 0
           AND p.subscription_status IN ('trial', 'active') THEN 2
      ELSE 0
    END
  )
    WHEN 0 THEN 'healthy'
    WHEN 1 THEN 'needs_attention'
    WHEN 2 THEN 'at_risk'
    ELSE 'inactive'
  END AS health_tier
FROM profiles p
JOIN instructor_funnel_status f ON f.user_id = p.id
LEFT JOIN LATERAL (
  -- Sinyal recency Health: attendance + registrations.attended=true (BUKAN
  -- confirmed_at). Direvisi dari versi awal yang sempat memakai confirmed_at -
  -- konfirmasi pembayaran adalah bukti komitmen/transaksi, BUKAN bukti layanan
  -- nyata terjadi (kategori sinyal yang sama persis dengan Membership Sale yang
  -- sudah ditolak sebagai bukti Aktivasi). Memakai confirmed_at di sini akan
  -- membuka kembali celah false-positive yang sama di level Health.
  --
  -- Sengaja dipakai bersumber SAMA PERSIS dengan logika Aktivasi (lihat lateral
  -- "act" di instructor_funnel_status di atas) - bukan dua definisi berbeda
  -- untuk pertanyaan yang sama. Ini juga tetap melindungi instruktur Jalur A
  -- event-led yang sah tidak pernah punya baris di tabel attendance.
  --
  -- Broadcast SENGAJA tidak diikutkan (lihat PRE_IMPLEMENTATION_REVIEW.md Part A).
  SELECT MAX(activity_at) AS last_operational_activity_at
  FROM (
    SELECT created_at AS activity_at FROM attendance WHERE user_id = p.id
    UNION ALL
    SELECT COALESCE(r.session_date::timestamptz, ev.event_date::timestamptz) AS activity_at
    FROM registrations r
    LEFT JOIN events ev ON ev.id = r.event_id
    WHERE r.user_id = p.id AND r.attended = true
  ) combined
) recency ON true
LEFT JOIN LATERAL (
  SELECT COUNT(*) AS active_class_count
  FROM classes c WHERE c.user_id = p.id AND c.is_active = true
) classes_active ON true
LEFT JOIN LATERAL (
  -- bot_phone hanya pernah terisi kalau koneksi PERNAH benar-benar berhasil
  -- (lihat catatan yang sama di admin/[profileId]/page.tsx) - dipakai sebagai
  -- proxy "pernah tersambung" tanpa butuh migrasi histori koneksi baru.
  --
  -- wa_previously_connected BUKAN status realtime - hanya menunjukkan token+
  -- nomor masih TERSIMPAN di database kita, bukan status koneksi sungguhan di
  -- Fonnte saat ini. Dibuktikan langsung lewat insiden GetFuel: Fonnte
  -- melaporkan status disconnect padahal fonnte_token & bot_phone masih utuh
  -- di profiles. Deteksi disconnect realtime tetap scope Phase 2 (migrasi
  -- histori koneksi WA, bot_connected_at/bot_disconnected_at) - belum ada di
  -- sini. Nama field sengaja TIDAK dipakai "wa_currently_connected" supaya
  -- tidak menjanjikan akurasi yang belum bisa dipenuhi.
  SELECT
    (p.bot_phone IS NOT NULL)                                                            AS wa_ever_connected,
    (p.fonnte_token IS NOT NULL AND length(trim(p.fonnte_token)) > 10 AND p.bot_phone IS NOT NULL)
                                                                                            AS wa_previously_connected
) wa ON true
WHERE f.is_activated;

COMMENT ON VIEW instructor_health_tier IS
  'Platform Admin V1: 4-tier Health (Healthy/Needs Attention/At Risk/Inactive), broadcast dikecualikan, HANYA instruktur Activated. Lihat docs/PLATFORM_ADMIN_V1_PRE_IMPLEMENTATION_REVIEW.md Part A.';

-- ─────────────────────────────────────────────────────────────────
-- 3. Wrapper function - dipakai Customer Detail (satu instruktur).
--    List/Dashboard query view di atas LANGSUNG (agregat, bukan N+1).
-- ─────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION get_instructor_funnel_status(p_user_id UUID)
RETURNS SETOF instructor_funnel_status
LANGUAGE sql STABLE AS $$
  SELECT * FROM instructor_funnel_status WHERE user_id = p_user_id;
$$;

CREATE OR REPLACE FUNCTION get_instructor_health_tier(p_user_id UUID)
RETURNS SETOF instructor_health_tier
LANGUAGE sql STABLE AS $$
  SELECT * FROM instructor_health_tier WHERE user_id = p_user_id;
$$;

-- ─────────────────────────────────────────────────────────────────
-- 4. Akses - service_role saja. Views ini menampilkan data lintas-tenant
--    (semua instruktur sekaligus), TIDAK BOLEH bisa dibaca anon/authenticated
--    sama sekali (beda dari tabel dasarnya yang RLS-scoped per user_id).
-- ─────────────────────────────────────────────────────────────────
REVOKE ALL ON instructor_funnel_status FROM PUBLIC, anon, authenticated;
GRANT SELECT ON instructor_funnel_status TO service_role;

REVOKE ALL ON instructor_health_tier FROM PUBLIC, anon, authenticated;
GRANT SELECT ON instructor_health_tier TO service_role;

REVOKE ALL ON FUNCTION get_instructor_funnel_status(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_instructor_funnel_status(UUID) TO service_role;

REVOKE ALL ON FUNCTION get_instructor_health_tier(UUID) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION get_instructor_health_tier(UUID) TO service_role;
