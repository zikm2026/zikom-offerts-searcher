# Zikom Offers Searcher

API serwer zbudowany z Express.js i TypeScript według najlepszych praktyk.

## 🚀 Funkcjonalności

- ✅ TypeScript z pełną konfiguracją
- ✅ ESLint + Prettier dla jakości kodu
- ✅ Struktura projektu zgodna z best practices
- ✅ Error handling middleware
- ✅ Security middleware (Helmet, CORS, Rate Limiting)
- ✅ Logging z Morgan
- ✅ Environment variables z dotenv
- ✅ Graceful shutdown
- ✅ Path aliases dla łatwego importowania
- ✅ Konfiguracja testów z Jest
- ✅ Email monitoring service (IMAP) - automatyczne sprawdzanie nowych wiadomości
- ✅ Gemini AI integration - analiza emaili pod kątem ofert laptopów
- ✅ Excel parsing - automatyczne wyciąganie danych z załączników Excel
- ✅ Laptop matching - inteligentne dopasowanie laptopów z ofert do bazy danych z obliczaniem cen
- ✅ Push notifications (ntfy.sh) - powiadomienia na telefon o znalezionych laptopach
- ✅ Panel Admina - zarządzanie listą obserwowanych laptopów (Basic Auth)

## 📁 Struktura projektu

```
zikom-offerts-searcher/
├── src/
│   ├── config/          # Konfiguracja aplikacji
│   ├── controllers/     # Kontrolery (logika request/response)
│   ├── middleware/      # Middleware (error handling, auth, etc.)
│   ├── models/          # Modele danych
│   ├── routes/          # Definicje routingu
│   ├── services/        # Logika biznesowa
│   ├── types/           # Definicje typów TypeScript
│   ├── utils/           # Narzędzia pomocnicze
│   ├── app.ts           # Konfiguracja Express app
│   └── server.ts        # Entry point serwera
├── tests/               # Testy
├── dist/                # Skompilowany kod (generowany)
├── .env.example         # Przykładowe zmienne środowiskowe
├── .eslintrc.json       # Konfiguracja ESLint
├── .prettierrc.json     # Konfiguracja Prettier
├── jest.config.js       # Konfiguracja Jest
├── nodemon.json         # Konfiguracja Nodemon
├── tsconfig.json        # Konfiguracja TypeScript
└── package.json
```

## 🛠️ Instalacja

1. Zainstaluj zależności:
```bash
npm install
```

2. Skopiuj plik `.env.example` do `.env` i uzupełnij wartości:
```bash
cp .env.example .env
```

3. **Baza danych (Docker)** – uruchom PostgreSQL w kontenerze:
```bash
docker compose up -d
```
W pliku `.env` ustaw `DATABASE_URL` (przykład w `.env.example`). Zastosuj migracje:
```bash
npx prisma migrate deploy
```
(lub przy rozwoju: `npx prisma migrate dev`)

4. Uruchom serwer w trybie deweloperskim:
```bash
npm run dev
```

## 📜 Dostępne skrypty

- `npm run dev` - Uruchamia serwer w trybie deweloperskim z hot-reload (nodemon)
- `npm run build` - Kompiluje TypeScript do JavaScript
- `npm start` - Uruchamia skompilowany serwer produkcyjny
- `npm run start:dev` - Uruchamia serwer z ts-node-dev
- `npm run lint` - Sprawdza kod pod kątem błędów ESLint
- `npm run lint:fix` - Automatycznie naprawia błędy ESLint
- `npm run format` - Formatuje kod za pomocą Prettier
- `npm run format:check` - Sprawdza formatowanie kodu
- `npm test` - Uruchamia testy
- `npm run test:watch` - Uruchamia testy w trybie watch
- `npm run test:coverage` - Generuje raport pokrycia testami

## 🔧 Konfiguracja

### Email Service

Aplikacja obsługuje automatyczne sprawdzanie poczty email przez IMAP. Aby włączyć tę funkcjonalność, skonfiguruj następujące zmienne w pliku `.env`:

```env
EMAIL_USER=twoj-email@domena.pl
EMAIL_PASSWORD=twoje-haslo
EMAIL_HOST=serwer123.home.pl
EMAIL_PORT=993
EMAIL_TLS=true
EMAIL_CHECK_INTERVAL=60000
```

**Popularne konfiguracje IMAP:**

- **home.pl**: port 993 (TLS)
  - ⚠️ **Adres hosta nie to imap.home.pl!** Dla każdego konta host ma postać **serwerXXX.home.pl** (np. `serwer123.home.pl`).
  - Weź go z Panelu Klienta: **Poczta** → **Opcje** przy skrzynce → **Serwery pocztowe** (pole „Serwer IMAP”).
  - W `.env` ustaw `EMAIL_HOST=serwerXXX.home.pl` (dokładna wartość z panelu).
  - Webmail: https://poczta.home.pl

- **Onet.pl**: `imap.onet.pl:993` (TLS)
  - ⚠️ **Wymagane**: Aktywuj dostęp IMAP w ustawieniach konta
  - Przejdź do: Ustawienia → Bezpieczeństwo → Programy pocztowe → Włącz IMAP

- **Gmail**: `imap.gmail.com:993` (TLS)
  - ⚠️ **Wymagane**: Użyj hasła aplikacji zamiast zwykłego hasła
  - Włącz 2FA w Google Account
  - Wygeneruj hasło aplikacji: https://myaccount.google.com/apppasswords

- **Outlook/Hotmail**: `outlook.office365.com:993` (TLS)
  - ⚠️ **Wymagane**: Włącz IMAP w ustawieniach konta Microsoft

**Uwagi:**
- `EMAIL_CHECK_INTERVAL` - interwał sprawdzania w milisekundach (domyślnie 60000 = 60 sekund)
- Serwis automatycznie łączy się przy starcie serwera
- Nowe wiadomości są logowane w konsoli jako "New Mail"
- Serwis obsługuje graceful shutdown
- **Ważne**: Jeśli otrzymujesz błąd autentykacji, upewnij się, że dostęp IMAP jest włączony w ustawieniach konta email

### Notification Service (ntfy.sh)

Aplikacja obsługuje wysyłanie powiadomień push na telefon przez ntfy.sh, gdy znajdzie odpowiednie laptopy w ofercie.

#### Konfiguracja

Aby włączyć powiadomienia, skonfiguruj następujące zmienne w pliku `.env`:

```env
NTFY_TOPIC=twoj-unikalny-topic
NTFY_SERVER=https://ntfy.sh
NTFY_TOKEN=opcjonalny-token-dla-prywatnych-topicow
NTFY_ENABLED=true
```

#### Jak to działa?

1. **Utwórz topic na ntfy.sh:**
   - Odwiedź https://ntfy.sh
   - Wybierz unikalną nazwę topicu (np. `zikom-laptopy-2024`)
   - Zainstaluj aplikację ntfy.sh na telefonie
   - Zasubskrybuj swój topic w aplikacji

2. **Skonfiguruj zmienne środowiskowe:**
   ```env
   NTFY_TOPIC=zikom-laptopy-2024
   NTFY_ENABLED=true
   ```

3. **Opcjonalnie - prywatny topic:**
   - Jeśli chcesz zabezpieczyć swój topic, wygeneruj token w ustawieniach ntfy.sh
   - Dodaj token do `.env`: `NTFY_TOKEN=twoj-token`

#### Kiedy wysyłane są powiadomienia?

Powiadomienia są wysyłane automatycznie, gdy:
- ✅ **WSZYSTKIE** laptopy z Excel są w bazie danych (jako szukane modele)
- ✅ **Przynajmniej jeden** laptop spełnia kryteria cenowe

Powiadomienie zawiera:
- Tytuł emaila
- Listę znalezionych laptopów z parametrami (model, RAM, dysk, cena)
- Statystyki dopasowania

#### Retry Logic

Serwis automatycznie ponawia próby wysłania powiadomienia w przypadku błędu (maksymalnie 3 próby z exponential backoff).

**Uwagi:**
- Powiadomienia są wysyłane asynchronicznie i nie blokują głównego flow aplikacji
- Błędy wysyłania są logowane, ale nie przerywają przetwarzania emaili
- Możesz wyłączyć powiadomienia ustawiając `NTFY_ENABLED=false`

### Path Aliases

Projekt używa path aliases dla łatwiejszego importowania:

```typescript
import config from '@config';
import { asyncHandler } from '@middleware/asyncHandler';
import logger from '@utils/logger';
```

Dostępne aliases:
- `@/*` → `src/*`
- `@config/*` → `src/config/*`
- `@controllers/*` → `src/controllers/*`
- `@middleware/*` → `src/middleware/*`
- `@models/*` → `src/models/*`
- `@routes/*` → `src/routes/*`
- `@services/*` → `src/services/*`
- `@types/*` → `src/types/*`
- `@utils/*` → `src/utils/*`

## 📝 Najlepsze praktyki

1. **Kontrolery** - Obsługują request/response, delegują logikę do serwisów
2. **Serwisy** - Zawierają logikę biznesową
3. **Middleware** - Reużywalna logika między requestami
4. **Error Handling** - Używaj `CustomError` i `asyncHandler` dla async funkcji
5. **TypeScript** - Zawsze definiuj typy, unikaj `any`

## 🔒 Bezpieczeństwo

- Helmet dla nagłówków bezpieczeństwa
- CORS skonfigurowany
- Rate limiting na endpointach API
- Walidacja danych wejściowych (do dodania)

## 📚 Dodatkowe informacje

- Node.js >= 18.0.0
- TypeScript 5.3+
- Express 4.18+

## 🔐 Panel Admina

Panel admina umożliwia zarządzanie listą obserwowanych laptopów.

### Dostęp

Panel dostępny jest pod adresem: `http://localhost:3000/admin`

### Autoryzacja

Panel używa Basic Authentication. Domyślne dane logowania:
- **Username**: `admin` (lub wartość z `ADMIN_USERNAME` w `.env`)
- **Password**: `admin123` (lub wartość z `ADMIN_PASSWORD` w `.env`)

### Konfiguracja

Możesz zmienić dane logowania w pliku `.env`:

```env
ADMIN_USERNAME=twoj_login
ADMIN_PASSWORD=twoje_haslo
```

### Funkcjonalności

- ✅ Dodawanie laptopów do obserwacji (model, RAM, dysk, maksymalna cena, notatki)
- ✅ Edycja istniejących wpisów
- ✅ Usuwanie laptopów z listy
- ✅ Wyświetlanie wszystkich obserwowanych laptopów w tabeli

### API Endpoints

- `GET /admin` - Panel admina (HTML)
- `GET /api/admin/laptops` - Pobierz listę laptopów
- `POST /api/admin/laptops` - Dodaj nowy laptop
- `PUT /api/admin/laptops/:id` - Aktualizuj laptop
- `DELETE /api/admin/laptops/:id` - Usuń laptop

Wszystkie endpointy wymagają Basic Authentication.

## 📄 Licencja

ISC