# RandChat — İçerik Derecelendirmesi (Content Rating) Justification

Son güncelleme: 2024-01-01

## Seçilen Derecelendirme: **Mature 17+ (M)**

Google Play: `RATED_M` (Mature)

## Gerekçe

### 1. Neden "Mature 17+"?

RandChat, kullanıcılar arasında **rastgele görüntülü sohbet** sağlar. Her ne kadar AI moderasyonu (AWS Rekognition) her 15 saniyede bir kare tarasa da, ** kullanıcı tarafından oluşturulan içerik** 18+ kullanıcılardan bile olgun içerik içerebilir:

- Müstehcen içeriğin kısa süreli gösterimi (AI yakalana kadar)
- Taciz içerikli dil (chat mesajları)
- Şiddet içeren içerik (kullanıcı kamerası)
- Bahis/dolandırıcılık girişimleri

### 2. İçerik Derecelendirme Kategorileri

| Kategori | Derece | Açıklama |
|---|---|---|
| **Şiddet** | Orta | Kullanıcı kamerası, kavgaya varan tartışmalar |
| **Kan/iğrenç** | Yok | AI moderasyonu var ama hızlı yakalama garantisi yok |
| **Cinsel içerik** | Yüksek | Müstehcen içerik riski (AWS Rekognition engeller ama yine de) |
| **Uyuşturucu** | Yok | Doğrudan değil ama kullanıcılar bahis/tanıtım yapabilir |
| **Hakaret** | Orta | Chat profanite filtreli |
| **Kumar** | Yok | Bahis yok |

### 3. Neden "Everyone" veya "Teen" değil?

- 18 yaş altı kullanım yasaktır (Terms of Service Madde 1)
- Doğum yılı sorgulanır, 18 altı tespit edilirse otomatik ban
- Açık konuşma: 18 yaş üstü kullanıcılar arası müstehcen içerik riski yüksek
- AI moderasyonu gerçek zamanlı değil (15 saniye gecikme var)

### 4. Neden "Adults Only 18+" değil?

- "Adults Only 18+" (RATED_A_18) Google Play'de kullanılamaz (Play Store policy)
- En yüksek gerçek kategori: **Mature 17+**

### 5. IARC Derecelendirme

Aşağıdaki sorulara "Evet" cevabı verdik:

- Kullanıcılar birbiriyle gerçek zamanlı iletişim kuruyor mu? → **Evet**
- Bu iletişimde kullanıcının görsel/sesli iletişimi var mı? → **Evet**
- İçerik moderasyonu var mı? → **Evet** (AI + manuel)
- Müstehcen içerik riski var mı? → **Evet**

Bu cevaplara göre IARC tarafından **Mature 17+** önerilir.

### 6. Store Listing Compliance

- **Target audience**: Adults (18+)
- **Designed for families**: No
- **Ads**: None
- **In-app purchases**: Yes (coin packs + VIP subscription)

### 7. Yasal Yükümlülükler

- 5651 sayılı kanun kapsamında "İçerik Sağlayıcı" statüsündeyiz.
- Reşit olma şüphesi durumunda:
  - Kullanıcı anında banlanır (Strike.isUnderage=true → level=ban)
  - Hesap + cihaz kaydı BannedDevice tablosuna eklenir
  - Manuel moderatör incelemesi başlatılır
  - (Phase 10) NCMEC bildirimi otomatik yapılır

## 8. Sürekli İyileştirme

- AI moderasyon eşiği (REKOGNITION_MIN_CONFIDENCE) regular tuning
- Profanity kelime listesi güncel tutulur
- Strike seviyeleri + cooldown süreleri remote-config'den ayarlanır
