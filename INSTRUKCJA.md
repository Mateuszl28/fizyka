# Włączenie logowania (Firebase)

Strona działa na GitHub Pages, które tylko wyświetla pliki. Konta i wyniki uczniów przechowuje darmowy projekt Firebase (plan Spark, bez karty płatniczej).

## 1. Utwórz projekt
1. Wejdź na https://console.firebase.google.com i zaloguj się kontem Google.
2. Kliknij **Utwórz projekt**, wpisz nazwę, np. `fizyka-szkola`. Google Analytics możesz wyłączyć.

## 2. Włącz logowanie e-mailem i hasłem
1. Menu po lewej: **Kompilacja → Authentication → Rozpocznij**.
2. Zakładka **Metoda logowania** → **E-mail/hasło** → włącz pierwszy przełącznik → **Zapisz**.
3. Zakładka **Ustawienia → Autoryzowane domeny → Dodaj domenę** → wpisz `mateuszl28.github.io`.

## 3. Utwórz bazę danych
1. **Kompilacja → Firestore Database → Utwórz bazę danych**.
2. Lokalizacja: **europe-central2 (Warszawa)**, żeby dane były w UE.
3. Tryb: **produkcyjny**.
4. Zakładka **Reguły**: usuń wszystko, wklej zawartość pliku `firestore.rules` z tego repozytorium i kliknij **Opublikuj**.

## 4. Pobierz konfigurację
1. ⚙ **Ustawienia projektu → Ogólne → Twoje aplikacje** → ikona **`</>`** (aplikacja internetowa).
2. Nazwa: `strona`. Pola „Firebase Hosting” nie zaznaczaj. Kliknij **Zarejestruj aplikację**.
3. Skopiuj obiekt `firebaseConfig` (apiKey, authDomain, projectId…) i wklej go do pliku `firebase-config.js`.

Te klucze są publiczne z założenia. Dostęp do danych chronią reguły z pliku `firestore.rules`.

## Jak to działa
- **Nauczyciel** zakłada konto w `panel.html` (e-mail + hasło), tworzy klasy i dostaje kod klasy, np. `7A-K3P9`.
- **Uczeń** na stronie głównej klika „Zaloguj się → Załóż konto”, wpisuje kod klasy, login (np. `ola.k`) i hasło. Nie podaje adresu e-mail.
- W prezentacjach zapisują się: zaliczone wyzwania, wynik quizu, trening zadań, krzyżówka i gra.
- Nauczyciel widzi wyniki swoich klas w panelu i może je pobrać jako CSV.

## Dane osobowe (RODO)
Zapisujemy tylko login, kod klasy i wyniki. Warto poinformować uczniów i rodziców, jakie dane są zbierane i w jakim celu. Nauczyciel może usunąć dane ucznia w panelu.
