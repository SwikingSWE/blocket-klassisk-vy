# Integritetspolicy — Blocket Bilar, Klassisk vy

*Senast uppdaterad: 2026-07-27*

Kort version: tillägget samlar inte in någonting, skickar ingenting någonstans
och har ingen server. Allt du gör stannar i din egen webbläsare.

## Vad som lagras

Tillägget sparar följande i `chrome.storage.local`, alltså på din egen dator:

| Vad | Varför |
|-----|--------|
| Annons-ID för annonser du klickat på | för att kunna tona ner dem som lästa |
| Annons-ID för annonser du dolt | för att hålla dem borta ur listan |
| Annons-ID i jämförelselistan | för att kunna öppna dem sida vid sida |
| Sparade sökningar (etikett och webbadress) | för att kunna gå tillbaka till dem |
| Dina inställningar (täthet, tema, kolumner, om annonser visas) | för att komma ihåg hur du vill ha listan |

Ingenting av detta lämnar din dator. Det synkas inte mellan enheter, säkerhets\-
kopieras inte och kan inte läsas av oss — vi har ingenting att läsa det med.

## Vad som inte samlas in

Ingen personinformation. Inget konto, ingen inloggning, ingen e-postadress.
Ingen analys, ingen spårning, inga cookies, inga tredjepartsskript. Ingen
information om vad du söker efter eller vilka bilar du tittar på.

## Nätverkstrafik

Tillägget gör **inga egna nätverksanrop**. Det läser den information som
Blocket redan har skickat till din webbläsare när du själv besökte sidan, och
ritar om den som en tabell. Ingen extra begäran skickas till Blocket, och
ingenting skickas till oss eller till någon annan.

Om du klickar på en betald placering följer webbläsaren Blockets egna
klicklänk, precis som den hade gjort på deras egen sida. Det är din
navigering, inte ett anrop från tillägget.

## Behörigheter

Tillägget begär två saker, och inget mer:

- **`storage`** — för att spara listan ovan lokalt.
- **`https://www.blocket.se/*`** — för att kunna rita om just Blockets
  bilsidor. Tillägget är inaktivt på alla andra webbplatser.

## Radera dina uppgifter

Öppna tillägget i verktygsfältet och använd **Nollställ** respektive **Visa
alla igen**. Vill du ta bort allt: avinstallera tillägget, så tar Chrome bort
lagringen med det.

## Kontakt

Frågor om den här policyn ställs via projektets ärendehanterare på GitHub.
