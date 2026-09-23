# RandChat — User-Generated Content (UGC) Policy v1.0.0

Son güncelleme: 2024-01-01

## 1. Scope

Bu politika, kullanıcıların RandChat içinde oluşturduğu tüm içerik için geçerlidir:

- Profil bilgileri (kullanıcı adı, avatar, biyografi)
- Çağrı içi metin mesajları
- Çağrı sırasında yakalanan video kareleri (AI moderasyonu tarafından)

## 2. Yasak İçerik

Aşağıdaki içerik türleri kesinlikle yasaktır:

- **Müstehcen/nudite**: AWS Rekognition her 15 saniyede bir kare tarar, eşik üstünde otomatik aksiyon.
- **Çocuk istismarı (CSAM)**: Anında ban + NCMEC bildirimi (Phase 10).
- **Şiddet/kan**: Aynı moderasyon pipeline.
- **Nefret söylemi**: Profil/bio'da, kullanıcı adında.
- **Reşit olma şüphesi**: Anında ban + manuel inceleme.
- **Spam/phishing linkleri**: Chat mesajlarında link engeli.
- **Kişisel veri paylaşımı**: Başka kullanıcıların telefon/email/adres paylaşımı.

## 3. Moderasyon Araçları

### Otomatik (AI)
- AWS Rekognition ModerateLabels (her 15s)
- ChatFilterService (profanity + link block)
- Nickname profanity check (kullanıcı adı)

### Manuel (Moderatör)
- Rapor kuyruğu (admin_app → /reports)
- Ban/unban (admin_app → popup menu)
- Strike seviyesi manuel düşürme

## 4. İçerik Saklama

| İçerik tipi | Saklama süresi | Saklama yeri |
|---|---|---|
| Moderasyon kareleri | 90 gün | AWS S3 |
| Chat mesajları | 2 yıl | PostgreSQL |
| Profil bilgileri | Hesap silinene kadar | PostgreSQL |

## 5. İçerik Bildirimi

Kullanıcılar tek dokunuşla raporlayabilir (çağrı sırasında veya sonrasında):

- Çağrı sırasında: bottom bar → "Raporla" → ReportSheet
- Rapor nedeni: Nudite / Taciz / Reşit olma / Spam / Diğer
- Opsiyonel not ekleyebilir
- "Bu kullanıcıyı engelle" checkbox → kalıcı block

Rapor + otomatik kanıt paketi (son 3 kare + kullanıcı metası) → reports tablosu → moderatör kuyruğu.

## 6. Takedown Süreci

1. Rapor → reports.status = PENDING
2. Moderatör inceleme → status = REVIEWING
3. Aksiyon: ban / unban / resolve / dismiss → AuditLog
4. Kullanıcı bilgilendirme (push + email) — Phase 10.

## 7. Kullanıcı Sorumluluğu

Kullanıcı, oluşturduğu içeriğin yasal olduğundan emin olmalıdır. Aşağıdaki durumlarda yasal sorumluluk kullanıcıya aittir:

- Telif hakkı ihlali
- Kişilik hakları ihlali
- Taciz/threatening içerik
- Reşit olma şüphesi (3. kişiler için de geçerli)

## 8. İçerik Geri Çekme

Kullanıcı kendi içeriğini istediği zaman siler:

- Profil → düzenleme → temizle
- Chat → silinemez (audit amaçlı saklanır, profanite ile değiştirilmiş hali görünür)
- Hesap → GDPR silme → tüm metaveri anonimleştirilir

## 9. İletişim

- UGC ihbar: report@randchat.example
- Yasal: legal@randchat.example
