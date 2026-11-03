ALTER TABLE "Sport" ADD COLUMN "revision" INTEGER NOT NULL DEFAULT 1;
ALTER TABLE "Sport" ADD CONSTRAINT "Sport_revision_positive" CHECK ("revision" > 0);
-- Initial editable catalog. Existing choices and translations are preserved.
INSERT INTO "Sport" ("id", "slug", "active") VALUES
 ('70000000-0000-4000-8000-000000000001', 'football', true),
 ('70000000-0000-4000-8000-000000000002', 'basketball', true),
 ('70000000-0000-4000-8000-000000000003', 'volleyball', true),
 ('70000000-0000-4000-8000-000000000004', 'tennis', true)
ON CONFLICT ("slug") DO NOTHING;
INSERT INTO "SportTranslation" ("sportId", "locale", "name", "updatedAt")
SELECT s."id", t.locale::"Locale", t.name, CURRENT_TIMESTAMP FROM "Sport" s
JOIN (VALUES
 ('football', 'uz', 'Futbol'), ('football', 'ru', 'Футбол'), ('football', 'en', 'Football'),
 ('basketball', 'uz', 'Basketbol'), ('basketball', 'ru', 'Баскетбол'), ('basketball', 'en', 'Basketball'),
 ('volleyball', 'uz', 'Voleybol'), ('volleyball', 'ru', 'Волейбол'), ('volleyball', 'en', 'Volleyball'),
 ('tennis', 'uz', 'Tennis'), ('tennis', 'ru', 'Теннис'), ('tennis', 'en', 'Tennis')
) AS t(slug, locale, name) ON s."slug" = t.slug
ON CONFLICT ("sportId", "locale") DO NOTHING;
