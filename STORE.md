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
Blocket gjorde om bilsökningen i november 2025. Kortvyn som kom istället visar
ungefär två bilar i taget, och filtren flyttade in i en sidopanel.

Det här tillägget ritar om sökresultatet som en tät, sorterbar tabell — den sortens
lista man faktiskt kan skanna. I det kompakta läget får du ett tjugotal bilar på
skärmen samtidigt, med årsmodell, miltal, drivmedel, växellåda, pris, ort, säljare
och datum uppradade i kolumner så att siffrorna går att jämföra rakt nedåt.

FUNKTIONER

• Tre tätheter: Tät, Normal och Bilder. Välj hur mycket du vill se på en gång.
• Sorterbara kolumner. Bil, År, Mil, Pris och Inlagd sorterar hela sökresultatet
  via Blockets egen sortering. Drivmedel, Låda, Ort och Säljare sorterar sidan du
  har framför dig — de kolumnerna är markerade så att du vet skillnaden.
• Filterrad ovanför listan istället för sidopanel, med antal träffar bredvid varje
  val. Märke och modell fälls ut först när du valt ett märke.
• Lästmarkering. Annonser du klickat på tonas ned nästa gång du kommer tillbaka.
• Dölj annonser du inte vill se igen.
• Jämför. Bocka för flera bilar och öppna dem sida vid sida.
• Sparade sökningar, med ett klick tillbaka till exakt samma filter.
• Mörkt läge, om du vill.

INTEGRITET

Tillägget gör inga egna nätverksanrop. Det läser informationen Blocket redan har
skickat till din webbläsare och ritar om den. Ingen server, inget konto, ingen
spårning, ingen analys. Allt du markerar och sparar ligger kvar i din egen
webbläsare och skickas ingenstans.

Behörigheterna är två: lagring på din egen dator, och åtkomst till blocket.se.
Tillägget är inaktivt på alla andra webbplatser.

BETALDA PLACERINGAR

Betalda placeringar visas, överst i listan och tydligt märkta. De är avstängbara
med en kryssruta, men de visas som standard — annonserna är hur Blocket betalar
för sidan, och tillägget är till för att göra listan läsbar, inte för att ta bort
deras annonsplatser.

INTE OFFICIELLT

Det här är ett fristående tillägg utan koppling till Blocket eller Schibsted.
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

```bash
rm -f dist.zip && zip -r dist.zip manifest.json icons src -x '*.DS_Store'
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
