# Gayatri VHMS API — separate project

The Spring Boot API is **not** kept inside this UI tree.

**API folder (sibling on Desktop):**  
`C:\Users\harsh\OneDrive\Documents\Desktop\Gayatri-VHMS-API`

```bash
cd "../Gayatri-VHMS-API"
docker compose up -d
mvn spring-boot:run
```

UI proxies `/api` → `http://localhost:8080` (see `vite.config.js`).

Website Book → WhatsApp desk: **7204301779** (configured in UI property `notifyPhone`).
