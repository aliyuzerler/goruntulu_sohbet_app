# RandChat — Gizlilik Politikası (Privacy Policy) v1.0.0

Son güncelleme: 2024-01-01

## 1. Toplanan Veriler

### Hesap bilgileri
- Telefon numarası (E.164, SHA-256 hash olarak saklanır — KVKK Madde 4)
- Google subject ID (Google Sign-In kullananlar için)
- Profil: kullanıcı adı, avatar, cinsiyet, ülke, doğum yılı (18+ kontrolü için)

### Cihaz bilgileri
- Android ID (cihaz başına tek aktif oturum için)
- FCM token (push bildirim için)
- App version, platform

### Çağrı metaverisi
- Çağrı başlangıç/bitiş zamanı, süre, bitiş nedeni (user_left/report/moderation/timeout/low_balance)
- Ortalama ağ kalitesi (ms RTT)
- Çağrı içi sohbet mesajları (profanite filtreli, link engelli)

### Moderasyon verileri
- AWS Rekognition tarafından yakalanan kareler (S3'de saklanır, her 15 saniyede bir)
- Raporlar (neden, not, kanıt paketi: son 3 kare + kullanıcı metası)
- Strike geçmişi (seviye, son ihlal zamanı)

### Finansal veriler
- Jeton işlemleri (append-only ledger, idempotency key ile)
- Google Play satın alımları (orderId, purchaseToken, productId)
- VIP abonelik durumu (entitlement: ACTIVE/CANCELED/EXPIRED/GRACE)

## 2. Toplanmayan Veriler

- **Video görüşme içeriği**: AI moderasyonu dışında video akışı kaydedilmez. Moderasyon kareleri 90 gün sonra silinir.
- **Konum**: SIM/locale'den çıkarılan ülke dışında GPS verisi alınmaz.
- **Kişiler**: Telefon rehberinize erişilmez.

## 3. Veri Kullanımı

Veriler şu amaçlarla kullanılır:

- Hizmetin çalıştırılması (eşleştirme, çağrı, sohbet)
- Güvenlik ve moderasyon (NSFW tespiti, ban, strike sistemi)
- Faturalandırma (Google Play satın alımlar)
- Yasal yükümlülükler (KVKK/GDPR, finansal kayıt 7 yıl saklama)

## 4. Veri Paylaşımı

Üçüncü taraflarla paylaşım:

- **AWS**: Rekognition (NSFW tespiti), S3 (frame storage)
- **Google**: Play Billing (satın alma + abonelik), Firebase Auth (phone OTP + Google Sign-In)
- **Agora**: RTC video infrastructure (data flows through their network but is not stored)

Yasal yükümlülük durumunda (mahkeme kararı) veriler yetkili mercilerle paylaşılır.

## 5. Veri Saklama Süreleri

| Veri tipi | Saklama süresi | Gerekçe |
|---|---|---|
| Hesap bilgileri | Hesap silinene kadar | KVKK Madde 13 |
| Çağrı metaverisi | 2 yıl | Yasal yükümlülük (5651) |
| Moderasyon kareleri | 90 gün | Güvenlik + audit |
| Finansal kayıtlar | 7 yıl | Vergi mevzuatı |
| Strike geçmişi | 5 yıl | Tekrarlayan suistimal tespiti |

## 6. KVKK/GDPR Hakların

KVKK Madde 14-17 / GDPR Art. 15-17 kapsamında:

- **Veri indirme**: Ayarlar → Veri İndirme → JSON export (tüm verilerin tek dosyada)
- **Veri silme**: Ayarlar → Hesap Sil → 14 gün sonra anonimleştirme
- **Düzeltme**: Profil düzenleme ekranından
- **İtiraz**: legal@randchat.example

## 7. Çerez ve Tracking

- Reklam yok — third-party ad SDK'leri kullanılmaz.
- Firebase Analytics: anonim event tracking (Crashlytics + non-fatal error capture).
- IDFA/AAID: reklam amaçlı kullanılmaz, cihaz tanımlama için Android ID kullanılır.

## 8. Çocukların Gizliliği

18 yaş altı kullanım yasaktır. Doğum yılı sorgulanır; 18 altı tespit edilirse hesap otomatik banlanır + moderatöre bildirilir.

## 9. Değişiklikler

Politika değişirse, uygulamada bildirim gösterilecek ve 30 gün sonra yürürlüğe girecek.

## 10. İletişim

- Veri Sorumlusu: RandChat
- DPO: legal@randchat.example
- KVKK başvuru formu: https://randchat.example/kvkk-basvuru
