# Chrome Web Store — underlag för publicering

Allt som ska klistras in i utvecklarkonsolen, plus det som måste fångas för
hand. Texterna är på svenska: hela målgruppen är det.

## Fält

**Namn** (max 45 tecken)

```
Blocket Bilar – Klassisk vy
```

**Kort beskrivning / summary** (max 132 tecken — samma sträng som `description`
i `manifest.json`, håll dem i synk)

```
Ger tillbaka den täta, skannbara listvyn för bilar på Blocket. Filterrad, sorterbara kolumner, sparade sökningar och jämförelse.
```

**Kategori:** Verktyg (Tools)
**Språk:** Svenska

**Detaljerad beskrivning**

```
Tillägget återställer de visuella förändringar Blocket gjorde 2025 — men bara
för bilar. Resten av sajten lämnas orörd.

Sökresultatet ritas om som en tät, sorterbar lista med filtren ovanför
träffarna. Årsmodell, miltal, drivmedel, växellåda, pris, ort, säljare och
datum står i kolumner.

FUNKTIONER

• Tre tätheter: Tät (25 px per bil), Normal (79 px) och Bilder (127 px).
• Bil, År, Mil, Pris och Inlagd sorterar hela sökresultatet via Blockets egen
  sortering. Drivmedel, Låda, Ort och Säljare saknar motsvarighet hos Blocket
  och sorterar bara den aktuella sidan; de kolumnrubrikerna är markerade.
• Filterrad ovanför listan i stället för sidopanel. Varje alternativ visar
  antal träffar. Modeller fälls ut när ett märke valts. "Visa alla filter"
  öppnar Blockets egen panel för övriga filter.
• Annonser du klickat på tonas ned vid återbesök. ✕ döljer en annons. Båda
  nollställs från tilläggets meny.
• Förkryssade annonser samlas längst ned och kan öppnas samtidigt.
• Sparade sökningar behåller de valda filtren.
• Datum visas som "Idag 14:32", "Igår 23:48" och "12 jun 09:15". Exakt
  tidpunkt vid hovring.
• Annonssidor får en faktarad under priset, och bildytan begränsas i höjd.
• Mörkt läge.

BETALDA PLACERINGAR

Betalda placeringar visas överst i listan, märkta. De ingår inte i sorteringen
och räknas inte in i antalet träffar. De kan stängas av med en kryssruta.

INTEGRITET

Tillägget gör inga egna nätverksanrop. Det läser den information Blocket redan
har skickat till webbläsaren och ritar om den. Ingen server, inget konto, ingen
spårning, ingen analys.

Lästmarkeringar, dolda annonser, jämförelselistan och sparade sökningar lagras
i chrome.storage.local på din egen dator.

Behörigheter: lagring, samt åtkomst till blocket.se. Tillägget är inaktivt på
alla andra webbplatser.

INTE OFFICIELLT

Fristående tillägg utan koppling till Blocket eller Schibsted.
```

## Skärmbilder

Kravet är 1280×800 (eller 640×400), minst en, högst fem. Layouten är verifierad
i 1280×800 — fånga i det formatet.

Lättast är att köra tillägget mot riktiga blocket.se och fånga fönstret. States
att fånga, i den här ordningen:

1. **Tät vy, ljust tema, annonser på.** Huvudbilden. Visar ett tjugotal bilar,
   filterraden överst och den märkta betalda placeringen först i listan.
2. **Filterpanel öppen på "Märke & modell".** Visar antalet träffar bredvid varje
   märke — det är detaljen som säljer listan.
3. **Normal täthet med bilder.** För den som inte vill ha den tätaste vyn.
4. **Mörkt tema.** Kort och gott att det finns.
5. **Annonssidan** med faktarutan direkt under priset.

## Paketering

Ladda upp en zip med bara det som körs — inte tester, dokumentation eller
verktygskonfiguration. Extra filer gör paketet större och ger granskaren mer att
fråga om:

`icons/icon-source.png` är originalet som de tre storlekarna skalas ned från
och ska inte med i paketet.

```bash
rm -f dist.zip && zip -r dist.zip manifest.json icons src \
  -x '*.DS_Store' 'icons/icon-source.png'
```

## Före inskickning

- [ ] `description` i `manifest.json` och kort beskrivning ovan är identiska och
      under 132 tecken
- [ ] `version` höjd
- [ ] `node test/store.test.js` grönt
- [ ] Ikoner 16/48/128 finns — de gör det, men den nuvarande är en platshållare
      och tål att ritas om innan publicering
- [ ] Integritetspolicyn (`PRIVACY.md`) publicerad på en publik URL och länkad i
      formuläret; policyn är obligatorisk även när ingenting samlas in
- [ ] Ange i formuläret att ingen användardata samlas in eller överförs
- [ ] Motivera behörigheterna: `storage` för inställningar och markeringar
      lokalt, värdbehörigheten för blocket.se för att kunna rita om sidan
