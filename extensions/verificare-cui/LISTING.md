# Chrome Web Store — Verificare CUI ANAF | Tapselo

## Title (55 chars)

Verificare CUI ANAF – firmă, TVA și e-Factura | Tapselo

## Short description (128 chars)

Selectează un CUI pe orice pagină și vezi firma, adresa, statusul TVA și Registrul RO e-Factura, direct din datele publice ANAF.

## Long description

Verifici rapid orice firmă din România fără să părăsești pagina în care lucrezi.

**CUI din pagină sau din popup**
- Meniu contextual „Verifică CUI la ANAF” pe textul selectat (facturi, e-mailuri, ERP).
- Câmp CUI în popup, cu sau fără prefix RO și verificare a cifrei de control.

**Date din ANAF (PlatitorTvaRest v9)**
- Denumire și adresă
- Plătitor de TVA, TVA la încasare, inactiv fiscal, split TVA
- Registrul RO e-Factura (dacă nu apare în registru, afișăm clar că nu figurează la data interogării — fără a interpreta obligații legale)

**Tab secundar: cod de bare**
- Caută produsul în API-ul public Tapselo după EAN-13: denumire, categorie, cotă TVA — **fără prețuri**.

**Confidențialitate**
- Nu colectăm CUI-urile verificate pe serverele Tapselo.
- Fără analytics în extensie; cache local opțional pentru a respecta limita ANAF de 1 cerere/secundă.

Unelte web complementare: [tapselo.com/unelte/verificare-cui](https://tapselo.com/unelte/verificare-cui/?utm_source=chrome_extension&utm_medium=extension&utm_campaign=verificare_cui)

Politica de confidențialitate: https://tapselo.com/extensii/verificare-cui/confidentialitate/

## Category

Productivity

## Permission justifications

| Permission | Why |
|------------|-----|
| `contextMenus` | „Verifică CUI la ANAF” pe selecția de text. |
| `storage` | Cache local (~24 h) al răspunsurilor ANAF per CUI; nu trimitem CUI-uri la Tapselo. |
| `https://webservicesp.anaf.ro/*` | Apel direct POST către serviciul public ANAF PlatitorTvaRest v9. |
| `https://tapselo.com/*` | API public `/api/barcodes/{ean}` pentru tab-ul de cod de bare (fără preț). |

## Privacy questionnaire (answers)

- **Collects personal data?** No (we do not collect or store looked-up CUIs on Tapselo servers).
- **Data sold?** No.
- **Data used for unrelated purposes?** No analytics in the extension.
- **Encryption in transit?** Yes (HTTPS to ANAF and tapselo.com).
- **Privacy policy URL:** https://tapselo.com/extensii/verificare-cui/confidentialitate/

## Keyword targets (listing + site)

verificare cui · verificare tva · cautare firma dupa cui · verificare tva la incasare · verificare cod fiscal · registrul ro e-factura
