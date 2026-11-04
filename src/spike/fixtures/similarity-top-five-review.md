# Top-five review: ranks 4 and 5

Raising the published maximum from three to five neighbours (scoring v4, 2026-11-04) surfaced 11 previously unjudged candidates at ranks 4–5 of the 30 development queries; the other 15 slots at those ranks already carried a judgment. These source-based assistant judgments are provisional; they do not replace human validation. Existing reviews are unchanged. `npm run compare:similarity` incorporates this file.

Candidates were found by scoring the review queries on the archive of 2026-11-04 (same policy, threshold 0.1): there, ranks 4–5 hold 26 recommendations, 22 judged useful and 4 not (85%). The unhelpful slots score 0.125–0.57 and the useful ones 0.100–0.25, so no higher score floor for the extra slots would separate them. Scores record that snapshot.

On the frozen baseline corpus (`docs/` of 49cf5c5af, see [similarity-comparison.md](similarity-comparison.md)) the top five hold 76 recommendations, 70 useful, 6 unhelpful, none unresolved (92%), against 47 of 48 for the top three — ranks 4–5 alone 23 of 28 (82%).

### 1. 51623: Haushaltssperre 2025 Stadt Karlsruhe

- [t] `0.141` 23076 — **Doppelhaushalt 2009/2010: Haushaltswirtschaftliche Sperre für 2009** <!-- 51623 23076 --> <!-- reviewer: assistant; confidence: high -->

**Assistant review (high confidence):** An earlier budget freeze under the same GemHVO procedure; historical context for the 2025 Sperre.

- [s] `0.132` 2025/0073 — **Haushaltssicherung Stadt Karlsruhe: Haushaltswirtschaftliche Sperre** <!-- 51623 51492 --> <!-- reviewer: assistant; confidence: high -->

**Assistant review (high confidence):** The council resolution imposing the 2025 Sperre whose effects on Grötzingen the query motion asks about. Same matter.

### 2. 50329: Sachstand zur Umsetzung des Energieleitplans

- [t] `0.101` 2023/1415 — **Informationsveranstaltung „Kaltes Nahwärmenetz“** <!-- 50329 49838 --> <!-- reviewer: assistant; confidence: medium -->

**Assistant review (medium confidence):** A Grötzingen motion about a cold local-heating network that the Energieleitplan proposes there; local implementation context.

- [t] `0.100` 2023/1231 — **Einrichtung einer Koordinierungsstelle zur Vereinfachung des Fernwärme- und Energieleitungsausbaus** <!-- 50329 49623 --> <!-- reviewer: assistant; confidence: medium -->

**Assistant review (medium confidence):** The SPD motion explicitly motivated by the Energieleitplan's implementation speed; useful context for an implementation status report.

### 3. 51633: Baugebiet "Zukunft Nord" - Sachstandsinformation

- [s] `0.251` 2019/0381 — **Anordnung der Umlegung … "Westlich der Erzbergerstraße zwischen New-York-Straße und Lilienthalstraße"** <!-- 51633 37286 --> <!-- reviewer: assistant; confidence: high -->

**Assistant review (high confidence):** The land readjustment for the same Bebauungsplan area whose first partial plan the status report describes. Same matter.

### 4. 49977: Fortbestand ev. Gemeindezentrum und ev. Jakobskirche Wolfartsweier

- [t] `0.113` 2023/0963 — **Verhandlungen mit evangelischer Kirche Karlsruhe aufnehmen: Gemeindehäuser für die Stadtteile erhalten** <!-- 49977 49069 --> <!-- reviewer: assistant; confidence: high -->

**Assistant review (high confidence):** The citywide council motion on the same Landeskirche property review that threatens the Wolfartsweier Gemeindezentrum.

- [n] `0.107` 2022/0812 — **Fortbestand Reallabor Passagehof** <!-- 49977 47131 --> <!-- reviewer: assistant; confidence: medium -->

**Assistant review (medium confidence):** No usable extracted text; by title an inner-city urban-lab project sharing only the word “Fortbestand”. Not useful.

### 5. 50342: Erweiterung der Geschwindigkeitsbegrenzung auf 30 km/h über die Kreuzung Rittnertstraße/Hotzerweg

- [n] `0.131` 2018/0747 — **Erweiterung Tempo 30 in der Grötzinger Straße** <!-- 50342 36759 --> <!-- reviewer: assistant; confidence: medium -->

**Assistant review (medium confidence):** Same genre (extending a Tempo-30 stretch in Durlach) but a different street and situation. Not useful.

- [t] `0.128` 21438 — **Antrag + Anfrage GRÜNE: Lärmbelästigung Rittnertstraße durch LKW und Traktoren** <!-- 50342 21438 --> <!-- reviewer: assistant; confidence: medium -->

**Assistant review (medium confidence):** Traffic and noise history of the same street; context for its speed limit.

### 6. 50436: Bebauungsplanverfahren „Durlacher Allee, Güterumgehungsbahn Karlsruhe 4210, Durlacher Allee 106 (Alter Gleisbauhof) und Ostring", Oststadt

- [n] `0.132` 26898 — **Bebauungsplan "Östlich Ostring zwischen Haid-und-Neu-Straße und Mannheimer Straße", Karlsruhe-Rintheim: Aufstellungsbeschluss** <!-- 50436 26898 --> <!-- reviewer: assistant; confidence: high -->

**Assistant review (high confidence):** A 2011 Aufstellungsbeschluss for a different area that shares only “Ostring” and the procedure. Not useful.

- [n] `0.125` 2019/0416 — **Ochsentor/Nordöstlicher Altstadtrand Durlach: Aufstellungsbeschluss** <!-- 50436 37321 --> <!-- reviewer: assistant; confidence: high -->

**Assistant review (high confidence):** Unrelated Durlach planning area; matched on procedural Aufstellungsbeschluss wording. Not useful.

### 7. 50273: Bebauungsplan "KIT - Campus Ost an der Rintheimer Querallee 2", Karlsruhe-Rintheim; Satzungsbeschluss

- [t] `0.158` 2017/0675 — **Neuer Rahmenplan für das Areal KIT-Campus-Süd östlich des Adenauerrings** <!-- 50273 35900 --> <!-- reviewer: assistant; confidence: medium -->

**Assistant review (medium confidence):** Planning debate on KIT's campus expansion, consistent with the already accepted Campus-Süd Bebauungsplan candidates for this query.
