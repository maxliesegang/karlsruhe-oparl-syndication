# Similarity input comparison

Scoring version 1 → 3; same 14132 papers, 30 query papers and 150 reviewed pairs. Corpus SHA-256: `41ab8d6f2eaef14c69ea164ce02d82f4b8e9a5df930e4c82f8f08fc913c3b4a5`.

The [original review](similarity-review.md), labels, reviewer provenance and ordering are unchanged. Scores/ranks below are recomputed against the full corpus. New pairs have **no inherited judgment**. Existing assistant labels remain provisional; this is a development sample, not a held-out quality estimate.

Summary metrics incorporate 32 separately recorded [v2 follow-up judgments](similarity-pending-review.md) and [publication judgments](similarity-publication-review.md), adding 31 pairs and resolving only blank/uncertain originals. Original resolved labels always take precedence; conflicting resolved judgments cause an error. The frozen-pair table below preserves the original labels for audit.

Threshold held at 0.1; the same numeric threshold is not necessarily calibrated across representations. Precision below includes **judged pairs only**. Unresolved/new results are counted separately and must be reviewed before claiming overall precision.

| Results | Slots | Known useful | Known unhelpful | Unresolved/new | Precision among judged | Queries with known useful |
|---|---:|---:|---:|---:|---|---|
| Before, top 1 | 27 | 19 | 8 | 0 | 70% (19/27) | 19/30 |
| Before, top 3 | 73 | 43 | 30 | 0 | 59% (43/73) | 20/30 |
| After, top 1 | 19 | 19 | 0 | 0 | 100% (19/19) | 19/30 |
| After, top 3 | 48 | 47 | 1 | 0 | 98% (47/48) | 19/30 |

Original useful pairs still in top 3 above threshold: 43 → 36. Original unhelpful pairs still in top 3 above threshold: 30 → 0. These are retention counts within the old sample, not recall over all relevant papers.

## Re-scoring the frozen pairs

| Query → candidate | Judgment / reviewer | Old score | New score | Old rank | New rank |
|---|---|---:|---:|---:|---:|
| 51623 → 51855 | s / human | 0.286442 | 0.286703 | 1 | 1 |
| 51623 → 39849 | t / human | 0.206045 | 0.200633 | 2 | 2 |
| 51623 → 52049 | s / human | 0.169418 | 0.170652 | 3 | — |
| 51623 → 39724 | t / human | 0.167973 | 0.161981 | 4 | — |
| 51623 → 54346 | t / human | 0.145492 | 0.147426 | 5 | 3 |
| 52252 → 34542 | t / human | 0.099375 | 0.096601 | 1 | 1 |
| 52252 → 40570 | s / human | 0.075023 | 0.059083 | 2 | 2 |
| 52252 → 26096 | n / human | 0.073619 | 0.085008 | 3 | — |
| 52252 → 37982 | n / human | 0.061801 | 0.044100 | 4 | — |
| 52252 → 52199 | n / human | 0.053927 | 0.018698 | 5 | — |
| 51278 → 16539 | t / human | 0.101467 | 0.099647 | 1 | — |
| 51278 → 46749 | n / assistant | 0.076282 | 0.075655 | 2 | — |
| 51278 → 54094 | t / assistant | 0.075593 | 0.075366 | 3 | 1 |
| 51278 → 49385 | n / assistant | 0.069831 | 0.055561 | 4 | 7 |
| 51278 → 23225 | t / assistant | 0.066926 | 0.066187 | 5 | — |
| 50329 → 50818 | s / assistant | 0.175106 | 0.235444 | 1 | — |
| 50329 → 49757 | s / assistant | 0.162992 | 0.184439 | 2 | — |
| 50329 → 49707 | s / assistant | 0.162858 | 0.192352 | 3 | 1 |
| 50329 → 49581 | s / assistant | 0.139296 | 0.184485 | 4 | 2 |
| 50329 → 49749 | s / assistant | 0.127705 | 0.121702 | 5 | — |
| 50450 → 41582 | s / assistant | 0.256177 | 0.236059 | 1 | 3 |
| 50450 → 50002 | s / assistant | 0.245843 | 0.243290 | 2 | 1 |
| 50450 → 50491 | s / assistant | 0.236258 | 0.232770 | 3 | 4 |
| 50450 → 48914 | s / assistant | 0.225278 | 0.221309 | 4 | 5 |
| 50450 → 49612 | s / assistant | 0.224668 | 0.183267 | 5 | 10 |
| 51633 → 47776 | s / assistant | 0.226759 | 0.273647 | 1 | 2 |
| 51633 → 35723 | s / assistant | 0.169250 | 0.233986 | 2 | 6 |
| 51633 → 49791 | s / assistant | 0.159405 | 0.273885 | 3 | 1 |
| 51633 → 33117 | s / assistant | 0.158776 | 0.228345 | 4 | 7 |
| 51633 → 47766 | s / assistant | 0.158584 | 0.185202 | 5 | — |
| 49977 → 39883 | t / assistant | 0.253632 | 0.254275 | 1 | — |
| 49977 → 48848 | t / assistant | 0.192874 | 0.193450 | 2 | 1 |
| 49977 → 40622 | t / assistant | 0.175520 | 0.179077 | 3 | 2 |
| 49977 → 19474 | n / assistant | 0.170101 | 0.169418 | 4 | — |
| 49977 → 37771 | n / assistant | 0.132990 | 0.137677 | 5 | — |
| 51425 → 51233 | t / assistant | 0.095033 | 0.094416 | 1 | 1 |
| 51425 → 51184 | t / assistant | 0.094026 | 0.093260 | 2 | 2 |
| 51425 → 48906 | n / assistant | 0.086764 | 0.087799 | 3 | — |
| 51425 → 40135 | t / assistant | 0.077268 | 0.077176 | 4 | — |
| 51425 → 46625 | t / assistant | 0.076826 | 0.076857 | 5 | 4 |
| 54495 → 34542 | t / assistant | 0.100849 | 0.100980 | 1 | 1 |
| 54495 → 40570 | t / assistant | 0.100512 | 0.059702 | 2 | 3 |
| 54495 → 54496 | n / assistant | 0.084509 | 0.080851 | 3 | — |
| 54495 → 51693 | n / assistant | 0.075839 | 0.052687 | 4 | — |
| 54495 → 51668 | n / assistant | 0.061858 | 0.039307 | 5 | — |
| 50858 → 37628 | t / assistant | 0.778606 | 0.793922 | 1 | 1 |
| 50858 → 47750 | t / assistant | 0.740367 | 0.741939 | 2 | 2 |
| 50858 → 33932 | t / assistant | 0.717308 | 0.729258 | 3 | 3 |
| 50858 → 40835 | t / assistant | 0.705446 | 0.706060 | 4 | 4 |
| 50858 → 30155 | t / assistant | 0.699675 | 0.700075 | 5 | — |
| 52813 → 52838 | n / assistant | 0.476042 | 0.035202 | 1 | — |
| 52813 → 52795 | n / assistant | 0.434468 | 0.040553 | 2 | — |
| 52813 → 52898 | n / assistant | 0.427226 | 0.050985 | 3 | — |
| 52813 → 54028 | n / assistant | 0.408013 | 0.068625 | 4 | — |
| 52813 → 52950 | n / assistant | 0.380013 | 0.061636 | 5 | — |
| 51275 → 40137 | s / assistant | 0.839949 | 0.728353 | 1 | 3 |
| 51275 → 36572 | s / assistant | 0.464760 | 0.729172 | 2 | 2 |
| 51275 → 47903 | s / assistant | 0.455724 | 0.936904 | 3 | 1 |
| 51275 → 17537 | s / assistant | 0.354031 | 0.386308 | 4 | 4 |
| 51275 → 40977 | t / assistant | 0.206065 | 0.138318 | 5 | 7 |
| 51916 → 41319 | s / assistant | 0.768089 | 0.770859 | 1 | 1 |
| 51916 → 47002 | t / assistant | 0.688142 | 0.691625 | 2 | 2 |
| 51916 → 48768 | t / assistant | 0.648906 | 0.652105 | 3 | 3 |
| 51916 → 35522 | s / assistant | 0.615599 | 0.613841 | 4 | 5 |
| 51916 → 50464 | t / assistant | 0.615356 | 0.618784 | 5 | 4 |
| 54339 → 33154 | t / assistant | 0.099013 | 0.100882 | 1 | — |
| 54339 → 32955 | t / assistant | 0.093453 | 0.093788 | 2 | 1 |
| 54339 → 49688 | t / assistant | 0.081296 | 0.083489 | 3 | — |
| 54339 → 41106 | t / assistant | 0.079582 | 0.079075 | 4 | 2 |
| 54339 → 36145 | t / assistant | 0.076720 | 0.078557 | 5 | — |
| 50342 → 38105 | t / assistant | 0.219030 | 0.217780 | 1 | 1 |
| 50342 → 40793 | n / assistant | 0.167096 | 0.166008 | 2 | — |
| 50342 → 38110 | t / assistant | 0.163320 | 0.197782 | 3 | 2 |
| 50342 → 24812 | n / assistant | 0.151060 | 0.067925 | 4 | — |
| 50342 → 29302 | n / assistant | 0.149918 | 0.149363 | 5 | — |
| 50436 → 49998 | n / assistant | 0.168617 | 0.177521 | 1 | — |
| 50436 → 49778 | t / assistant | 0.165037 | 0.165354 | 2 | 1 |
| 50436 → 21432 | n / assistant | 0.163824 | 0.156712 | 3 | — |
| 50436 → 26728 | t / assistant | 0.156005 | 0.145066 | 4 | 3 |
| 50436 → 41630 | ? / assistant | 0.151449 | 0.153657 | 5 | — |
| 50618 → 48676 | t / assistant | 0.625181 | 0.619151 | 1 | — |
| 50618 → 23262 | n / assistant | 0.431587 | 0.429705 | 2 | — |
| 50618 → 50717 | n / assistant | 0.416757 | 0.418956 | 3 | — |
| 50618 → 50718 | n / assistant | 0.392372 | 0.395564 | 4 | — |
| 50618 → 50725 | n / assistant | 0.372222 | 0.378347 | 5 | — |
| 51776 → 35123 | n / assistant | 0.112935 | 0.079569 | 1 | — |
| 51776 → 47785 | ? / assistant | 0.098764 | 0.098441 | 2 | — |
| 51776 → 47068 | ? / assistant | 0.097733 | 0.097030 | 3 | — |
| 51776 → 41191 | t / assistant | 0.087650 | 0.086631 | 4 | — |
| 51776 → 37022 | t / assistant | 0.077073 | 0.070911 | 5 | — |
| 51361 → 54017 | n / assistant | 0.731425 | 0.728981 | 1 | — |
| 51361 → 54673 | n / assistant | 0.718811 | 0.717247 | 2 | — |
| 51361 → 51681 | n / assistant | 0.714922 | 0.713653 | 3 | — |
| 51361 → 52565 | n / assistant | 0.709190 | 0.707200 | 4 | — |
| 51361 → 51210 | n / assistant | 0.696063 | 0.694713 | 5 | — |
| 54797 → 50690 | s / assistant | 0.118291 | 0.117738 | 1 | — |
| 54797 → 36716 | n / assistant | 0.101045 | 0.018715 | 2 | — |
| 54797 → 51026 | s / assistant | 0.098300 | 0.097871 | 3 | — |
| 54797 → 23179 | t / assistant | 0.083984 | 0.083868 | 4 | — |
| 54797 → 39937 | t / assistant | 0.083523 | 0.082143 | 5 | — |
| 50363 → 40372 | n / assistant | 0.191123 | 0.187793 | 1 | — |
| 50363 → 54256 | n / assistant | 0.184823 | 0.185591 | 2 | — |
| 50363 → 48900 | n / assistant | 0.170018 | 0.168822 | 3 | — |
| 50363 → 51062 | n / assistant | 0.154565 | 0.158712 | 4 | — |
| 50363 → 47318 | n / assistant | 0.152090 | 0.159219 | 5 | — |
| 52903 → 52640 | s / assistant | 0.564804 | 0.458248 | 1 | 1 |
| 52903 → 52967 | n / assistant | 0.276975 | 0.023986 | 2 | — |
| 52903 → 52958 | n / assistant | 0.270007 | 0.173909 | 3 | — |
| 52903 → 54027 | n / assistant | 0.266882 | 0.184114 | 4 | — |
| 52903 → 54023 | n / assistant | 0.266746 | 0.179684 | 5 | — |
| 50273 → 35886 | ? / assistant | 0.130133 | 0.160797 | 1 | 4 |
| 50273 → 33476 | t / assistant | 0.128643 | 0.204658 | 2 | 2 |
| 50273 → 37555 | t / assistant | 0.116653 | 0.204592 | 3 | — |
| 50273 → 34990 | n / assistant | 0.112941 | 0.150166 | 4 | 7 |
| 50273 → 52610 | t / assistant | 0.105517 | 0.284708 | 5 | 1 |
| 50746 → 50740 | n / assistant | 0.554175 | 0.556734 | 1 | — |
| 50746 → 50742 | n / assistant | 0.522082 | 0.525864 | 2 | — |
| 50746 → 50744 | n / assistant | 0.494094 | 0.495417 | 3 | — |
| 50746 → 50743 | n / assistant | 0.493596 | 0.495970 | 4 | — |
| 50746 → 50741 | n / assistant | 0.493450 | 0.498006 | 5 | — |
| 51446 → 48782 | s / assistant | 0.232482 | 0.232753 | 1 | 1 |
| 51446 → 47911 | n / assistant | 0.085679 | 0.086788 | 2 | — |
| 51446 → 46450 | n / assistant | 0.082927 | 0.094439 | 3 | — |
| 51446 → 46474 | n / assistant | 0.082307 | 0.087743 | 4 | — |
| 51446 → 46292 | n / assistant | 0.078370 | 0.080100 | 5 | — |
| 52297 → 50948 | t / assistant | 0.975811 | 0.845015 | 1 | 1 |
| 52297 → 49322 | t / assistant | 0.717265 | 0.661642 | 2 | 2 |
| 52297 → 47684 | n / assistant | 0.670968 | 0.572137 | 3 | 4 |
| 52297 → 47033 | t / assistant | 0.586499 | 0.578167 | 4 | 3 |
| 52297 → 41849 | t / assistant | 0.502076 | 0.507890 | 5 | 5 |
| 50120 → 48737 | n / assistant | 0.188811 | 0.152970 | 1 | — |
| 50120 → 51688 | n / assistant | 0.165118 | 0.129402 | 2 | — |
| 50120 → 51252 | n / assistant | 0.161645 | 0.078222 | 3 | — |
| 50120 → 50544 | n / assistant | 0.159190 | 0.125146 | 4 | — |
| 50120 → 35545 | t / assistant | 0.153487 | 0.156724 | 5 | 1 |
| 50879 → 22992 | n / assistant | 0.587033 | 0.589459 | 1 | — |
| 50879 → 50569 | n / assistant | 0.526444 | 0.527704 | 2 | — |
| 50879 → 50512 | n / assistant | 0.505840 | 0.502798 | 3 | — |
| 50879 → 50877 | s / assistant | 0.450695 | 0.455169 | 4 | — |
| 50879 → 21628 | n / assistant | 0.429518 | 0.428900 | 5 | — |
| 51859 → 51858 | t / assistant | 0.735792 | 0.848007 | 1 | — |
| 51859 → 34467 | n / assistant | 0.698005 | 0.562844 | 2 | — |
| 51859 → 33463 | n / assistant | 0.697695 | 0.560429 | 3 | — |
| 51859 → 17755 | n / assistant | 0.691599 | 0.544642 | 4 | — |
| 51859 → 35307 | n / assistant | 0.689346 | 0.557438 | 5 | — |
| 52166 → 21258 | t / assistant | 0.180631 | 0.181101 | 1 | 1 |
| 52166 → 47517 | t / assistant | 0.126497 | 0.134234 | 2 | 2 |
| 52166 → 376 | t / assistant | 0.123958 | 0.122066 | 3 | 4 |
| 52166 → 49181 | t / assistant | 0.123577 | 0.123860 | 4 | 3 |
| 52166 → 41703 | n / assistant | 0.112478 | 0.014654 | 5 | — |

## Current candidates by query

Scores are shown for diagnosis; judge the original sources before assigning new labels. Previously reviewed candidates refer to the frozen review. New candidates include original-source evidence below. Nothing here updates the published indexes.

### 49977: Fortbestand ev. Gemeindezentrum und ev. Jakobskirche Wolfartsweier

<details><summary>Original query sources</summary>


[Paper record](../../../docs/papers/49977.json)
- Anfrage Wolfartsweier: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00655673.pdf>) · [extracted text](../../../docs/file-contents/655673.txt)
- Stellungnahme Anfrage Wolfartsweier: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00655684.pdf>) · [extracted text](../../../docs/file-contents/655684.txt)

Original content section — Anfrage Wolfartsweier:
> Gedruckt auf 100 Prozent Recyclingpapier Vorlage Nr.: 2024/0116 Eingang: Fortbestand ev. Gemeindezentrum und ev. Jakobskirche Wolfartsweier Anfrage der SPD-Ortschaftsratsfraktion Ortschaftsrat Wolfartsweier 10.04.2024 6 Ö Kenntnisnahme Ortschaftsrat Wolfartsweier 08.05.2024 3 Ö Kenntnisnahme Die evangelische Landeskirche hat die in Ihrem Eigentum stehenden Immobilien einer Bewertung und Kategorisierung in einem Ampelprinzip unterzogen. Die zentrale Finanzierung durch die Landeskirche stellt sicher, dass die Kosten für die Instandhaltung und Bewirtschaftung der Gebäude getragen werden. Die Entscheidung über den zukünftigen Liegenschaftsbestand in den Kirchenbezirken werden in den Kirchenbezirken getroffen. In der gesamten Landeskirche können aufgrund der finanziellen Situation nicht mehr alle Kirchen und Gemeindehäuser in der zentralen Finanzierung gehalten werden. Es wird in folgenden Kategorien unterschieden: Grün: 30% der Gebäude verbleiben in der zentralen Finanzierung und werden da…


</details>

- 0.193450 · t (assistant) · 48848: Renovierung/Restaurierung der Grabplatten am Haupteingang der Jakobskirche

- 0.179077 · t (assistant) · 40622: Evangelisches Gemeindezentrum - Nutzungsänderung Alte Aussegnungshalle - Anfrage CDU-Ortschaftsratsfraktion

- 0.128211 · t (assistant, follow-up review) · 37062: Antrag des Bürgervereins Knielingen e.V. für ein Bürgerzentrum im evangelischen Gemeindezentrum Struvestraße

<details><summary>Original candidate sources</summary>


[Paper record](../../../docs/papers/37062.json)
- TOP 4 BZ\_Knielingen: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00609225.pdf>) · [extracted text](../../../docs/file-contents/609225.txt)
- Anlage BZ Knielingen: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00609138.pdf>)

Original content section — TOP 4 BZ\_Knielingen:
> Der Hauptausschuss nimmt das Konzept für ein Bürgerzentrum in Knielingen zur Kenntnis und beschließt, dem Bürgerverein Knielingen ab dem 1. April 2019 einen Zuschuss in Höhe von 1.454,00 Euro monatlich (17.448,00 Euro pro Jahr) entsprechend den Richtlinien zur Förderung von Bürgerzentren zu gewähren. Die Evangelische Kirche in Karlsruhe ist derzeit noch mehrwertsteuerbefreit. Aufgrund der ein- tretenden Steuerpflicht ab 1. Januar 2021 wird sich jedoch der monatliche Mietbetrag für den Bürgerverein Knielingen um die Mehrwertsteuer von derzeit 19 % bzw. 276,26 Euro auf 1.730,26 Euro erhöhen (20.763,12 Euro p.a.). Die Verwaltung wird mit diesem Beschluss er- mächtigt, den Zuschussbetrag ab 1. Januar 2021 entsprechend um die Mehrwertsteuer zu er- höhen. Finanzielle Auswirkungen Gesamtkosten der Maß- nahme Einzahlungen/Erträge (Zuschüsse u. Ä.) Jährliche laufende Belastung (Folgekosten mit kalkulatorischen Kosten abzügl. Fol- geerträge und Folgeeinsparungen) Ja Nein 4/19-12/20: 1.454 € p.m.…

Passage sharing title words (context only) — TOP 4 BZ\_Knielingen:
> tadt Karlsruhe Der Oberbürgermeister BESCHLUSSVORLAGE Vorlage Nr.: Verantwortlich: 2019/0146 Dez. 2 Antrag des Bürgervereins Knielingen e.V. für ein Bürgerzentrum im evangelischen Gemeindezentrum Struvestraße Beratungsfolge dieser Vorlage Gremium Termin TOP ö nö Ergebnis Hauptausschuss 07.05.2019 4 x zugestimmt Beschlussantrag Der Hauptausschuss nimmt das Konzept für ein Bürgerzentrum in Knielingen zur Kenntnis und beschließt, dem Bürgerverein Knielingen ab dem 1. April 2019 einen Zuschuss in Höhe von 1.454,00 Euro monatlich (17.448,00 Euro pro Jahr) entsprechend den Richtlinien zur Förderung von Bürgerzentren zu gewähren. Die Evangelische Kirche in Karlsruhe ist derzeit noch mehrwertsteuerb…


</details>

### 50120: Teilerneuerung der Lärmschutzwand Geroldsäcker

<details><summary>Original query sources</summary>


[Paper record](../../../docs/papers/50120.json)
- Beschlussvorlage: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00656604.pdf>) · [extracted text](../../../docs/file-contents/656604.txt)
- Systemskizze: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00656593.pdf>) · [extracted text](../../../docs/file-contents/656593.txt)
- Lageplan: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00656594.pdf>) · [extracted text](../../../docs/file-contents/656594.txt)

Original Kurzfassung — Beschlussvorlage:
> Der Bauausschuss genehmigt die Vergabe folgender Arbeiten: Teilerneuerung der Lärmschutzwand Geroldsäcker Vergabe der Tiefbauarbeiten an die Firma Heim Infrastrukturbau GmbH, Göppingen zum Angebot vom 4. März 2024 abschließend mit 693.000 Euro Die Verwaltung wird ermächtigt, den Zuschlag zu erteilen.


</details>

- 0.156724 · t (assistant) · 35545: Erschließung Stupferich, Lärmschutzwand Klam/Illwig: Vergabe von Tiefbauarbeiten

- 0.093204 · **new, unreviewed** · 37447: SSP Mühlburg, Umbau der Weinbrennerstraße zwishen Nuitsstraße und Am Entenfang: Vergabe der Tiefbauarbeiten · below threshold

<details><summary>Original candidate sources</summary>


[Paper record](../../../docs/papers/37447.json)
- TOP 2 SSP Mühlburg: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00609908.pdf>) · [extracted text](../../../docs/file-contents/609908.txt)
- 2\_TBA\_öff\_Anlage: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00609909.pdf>) · [extracted text](../../../docs/file-contents/609909.txt)

Original content section — TOP 2 SSP Mühlburg:
> Der Bauausschuss genehmigt die Vergabe folgender Arbeiten: SSP Mühlburg, Umbau der Weinbrennerstraße zwischen Nuitsstraße und Am Entenfang an die Firma Jean Bratengeier Bau GmbH, Dreieich zum Angebot vom 24. April 2019 abschließend mit 1.218.490 Euro Die Verwaltung wird ermächtigt, den Zuschlag zu erteilen. Finanzielle Auswirkungen Gesamtkosten der Maß- nahme Einzahlungen/Erträge (Zuschüsse u. Ä.) Jährliche laufende Belastung (Folgekosten mit kalkulatorischen Kosten abzügl. Fol- geerträge und Folgeeinsparungen) Ja Nein 1.650.000 Euro 450.000 Euro Betrieb und Unterhaltung 9.000 Euro/a kalkulatorische Kosten 47.000 Euro/a Haushaltsmittel sind dauerhaft im Budget vorhanden Ja Nein Die Finanzierung wird auf Dauer wie folgt sichergestellt und ist in den ergänzenden Erläuterungen auszuführen: Durch Wegfall bestehender Aufgaben (Aufgabenkritik) Umschichtungen innerhalb des Dezernates Der Gemeinderat beschließt die Maßnahme im gesamtstädtischen Interesse und stimmt einer Etatisierung in den Fo…


</details>

- 0.088164 · **new, unreviewed** · 33835: Sanierung der Hagsfelder Brücke: Vergabe der Tiefbauarbeiten · below threshold

<details><summary>Original candidate sources</summary>


[Paper record](../../../docs/papers/33835.json)
- Hagsfelder Brücke: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00150421.pdf>) · [extracted text](../../../docs/file-contents/150421.txt)
- Anlage Hagsfelder Brücke Lageplan: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00150422.pdf>)

Original content section — Hagsfelder Brücke:
> Der Gemeinderat genehmigt nach Vorberatung im Bauausschuss die Vergabe folgender Arbeiten: Sanierung der Hagsfelder Brücke Vergabe der Tiefbauarbeiten an die Firma b+s bauwerkserhaltung GmbH, Bietigheim zum Angebot vom 04.12.2014 abschließend mit 1.220.499 € Die Verwaltung wird ermächtigt, den Zuschlag zu erteilen. Finanzielle Auswirkungen nein ja Gesamtkosten der Maßnahme Einzahlungen/Erträge (Zuschüsse u. Ä.) Finanzierung durch städtischen Haushalt Jährliche laufende Belastung (Folgekosten mit kalkulatori- schen Kosten abzügl. Folgeer- träge und Folgeeinsparungen) 2.060.000 € Haushaltsmittel stehen in voller Höhe zur Verfügung Kontierungsobjekt: Projekt: 7.661030. Kontenart: 78720000 Ergänzende Erläuterungen: ISEK Karlsruhe 2020 - relevant nein ja Handlungsfeld: (bitte auswählen) Anhörung Ortschaftsrat (§ 70 Abs. 1 GemO) nein ja durchgeführt am Abstimmung mit städtischen Gesellschaften nein ja abgestimmt mit Ergänzende Erläuterungen Seite 2 1.1 Kurzbeschreibung des Bauvorhabens und d…


</details>

### 50273: Bebauungsplan "KIT - Campus Ost an der Rintheimer Querallee 2", Karlsruhe-Rintheim; Satzungsbeschluss gemäß § 10 Abs. 1 Baugesetzbuch (BauGB)

<details><summary>Original query sources</summary>


[Paper record](../../../docs/papers/50273.json)
- Satzungsbeschluss KIT Campus Ost: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00657514.pdf>) · [extracted text](../../../docs/file-contents/657514.txt)
- Begründung: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00657460.pdf>) · [extracted text](../../../docs/file-contents/657460.txt)
- Satzungsbeschluss Anlage 1\_Synopse\_Offenlage: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00657457.pdf>) · [extracted text](../../../docs/file-contents/657457.txt)
- Umweltbericht: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00657461.pdf>) · [extracted text](../../../docs/file-contents/657461.txt)
- Planzeichnung: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00657764.pdf>) · [extracted text](../../../docs/file-contents/657764.txt)
- Festsetzungen: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00657765.pdf>) · [extracted text](../../../docs/file-contents/657765.txt)

Original Kurzfassung — Satzungsbeschluss KIT Campus Ost:
> Satzungsbeschluss zum Bebauungsplan als Abschluss des Verfahrens (im vollständigen Wortlaut auf Seite 5).


</details>

- 0.284708 · t (assistant) · 52610: Bebauungsplan "General-Kammhuber-Kaserne"

- 0.204658 · t (assistant) · 33476: ÖPNV-Anbindung des KIT Campus-Ost verbessern

- 0.179241 · t (assistant, follow-up review) · 35487: Bebauungsplan "KIT Campus Süd/Adenauerring", Karlsruhe-Oststadt: Auslegungsbeschluss gemäß § 3 Abs. 2 des Baugesetzbuches (BauGB)

<details><summary>Original candidate sources</summary>


[Paper record](../../../docs/papers/35487.json)
- TOP 6 Bebauungsplan KIT Campus Süd / Adenauerring Auslegungsbeschluss: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00597082.pdf>) · [extracted text](../../../docs/file-contents/597082.txt)
- TOP 6 Anlage 1 Beteiligung der Behörden: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00597083.pdf>) · [extracted text](../../../docs/file-contents/597083.txt)
- TOP 6 Anlage Textfestsettzungen\_Adenauerring\_Stand\_Entwurf: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00597084.pdf>) · [extracted text](../../../docs/file-contents/597084.txt)
- TOP 6 Anlage 2 Beteiligung der Öffentlichkeit: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00597085.pdf>) · [extracted text](../../../docs/file-contents/597085.txt)
- TOP 6 Anlage Begruendung\_Adenauerring\_Stand\_Entwurf: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00597086.pdf>) · [extracted text](../../../docs/file-contents/597086.txt)
- Planzeichnung Adenauerring\_groß: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00597087.pdf>) · [extracted text](../../../docs/file-contents/597087.txt)

Original content section — TOP 6 Bebauungsplan KIT Campus Süd / Adenauerring Auslegungsbeschluss:
> Der Gemeinderat der Stadt Karlsruhe beschließt, das Bebauungsplanverfahren „KIT Campus Süd / Adenauerring“, Karlsruhe-Oststadt, mit der öffentlichen Auslegung des Planentwurfes fortzusetzen (Beschluss im Wortlaut Seite 10). Finanzielle Auswirkungen (bitte ankreuzen) x nein ja Gesamtkosten der Maßnahme Einzahlungen/Erträge (Zuschüsse u. Ä.) Finanzierung durch städtischen Haushalt Jährliche laufende Belastung (Folgekosten mit kalkulatori- schen Kosten abzügl. Folgeer- träge und Folgeeinsparungen) Haushaltsmittel stehen Wählen Sie ein Element aus. Kontierungsobjekt: Wählen Sie ein Element aus. Kontenart: Ergänzende Erläuterungen: ISEK-Karlsruhe-2020-relevant x nein ja Handlungsfeld: Wählen Sie ein Element aus. Anhörung Ortschaftsrat (§ 70 Abs. 1 GemO) x nein ja durchgeführt am Abstimmung mit städtischen Gesellschaften x nein ja abgestimmt mit Ergänzende Erläuterungen Seite 2 I. Erläuterungen zur Planung Das Areal östlich des Adenauerrings stellt die letzte größere Entwicklungsfläche auf d…

Passage sharing title words (context only) — TOP 6 Bebauungsplan KIT Campus Süd / Adenauerring Auslegungsbeschluss:
> Stadt Karlsruhe Der Oberbürgermeister BESCHLUSSVORLAGE Vorlage Nr.: 2017/0226 Verantwortlich: Dez.6 Bebauungsplan „KIT Campus Süd / Adenauerring“, Karlsruhe-Oststadt: Auslegungsbeschluss gemäß § 3 Abs. 2 des Baugesetzbuches (BauGB) Beratungsfolge dieser Vorlage Gremium Termin TOP ö nö Ergebnis Gemeinderat 25.04.2017 6 x Beschlussantrag Der Gemeinderat der Stadt Karlsruhe beschließt, das Bebauungsplanverfahren „KIT Campus Süd / Adenauerring“, Karlsruhe-Oststadt, mit der öffentlichen Auslegung des Planentwurfes fortzusetzen (Beschluss im Wortlaut Seite 10). Finanzielle Auswirkungen (bitte ankreuzen) x nein ja Gesamtkosten der Maßnahme Einzahlungen/Erträge (Zuschüsse u. Ä.) Finanzierung durch s…


</details>

### 50329: Sachstand zur Umsetzung des Energieleitplans

<details><summary>Original query sources</summary>


[Paper record](../../../docs/papers/50329.json)
- Informationsvorlage: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00657973.pdf>) · [extracted text](../../../docs/file-contents/657973.txt)
- Präsentation zum Energieleitplan: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00658484.pdf>) · [extracted text](../../../docs/file-contents/658484.txt)

Original Kurzfassung — Informationsvorlage:
> Der Energieleitplan wurde vom Gemeinderat am 28. November 2023 als strategisches Planungsinstrument für die klimaneutrale Energieversorgung der Zukunft beschlossen. Der Umwelt- und Arbeitsschutz (UA) berichtet dem Ausschuss in regelmäßigen Abständen über den Umsetzungsstand des Energieleitplans. Seit der Vorlage des Energieleitplanes beim Regierungspräsidium Karlsruhe im Dezember 2023 wurden folgende Maßnahmen ergriffen: Ergänzungen zum Energieleitplan: Das Fachbüro tilia GmbH wurde mit einer Ergänzung zum Energieleitplan beauftragt, die Anregungen der Gremien, des Klimaschutzbeirates und der Bevölkerung aufnimmt. Es wird unter anderem ein neues Szenario unter der Annahme einer differenzierten Sanierungsquote berechnet. Roadmap zum Energieleitplan: Die kommunalen Akteur\*innen arbeiten unter Federführung des UA mit der Karlsruher Energie- und Klimaschutzagentur (KEK) und den Stadtwerken Karlsruhe (SWK) gemeinsam an einem detaillierten Zeitplan für die Umsetzung des Energieleitplans. Die…


</details>

- 0.192352 · s (assistant) · 49707: Klare Roadmap für den Energieleitplan

- 0.184485 · s (assistant) · 49581: Energieleitplan mit integrierter kommunaler Wärmeplanung der Stadt Karlsruhe

- 0.126438 · t (assistant, follow-up review) · 48347: Klimaziele erreichen - Ausbau Fernwärme Netz in Durlach

<details><summary>Original candidate sources</summary>


[Paper record](../../../docs/papers/48347.json)
- TOP 9, Stellungnahme Klimaziele erreichen - Ausbau Fernwärme Netz in Durlach: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00646318.pdf>) · [extracted text](../../../docs/file-contents/646318.txt)
- TOP 9, Anfrage Klimaziele erreichen - Ausbau Fernwärme Netz in Durlach: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00646479.pdf>) · [extracted text](../../../docs/file-contents/646479.txt)

Original opening — TOP 9, Stellungnahme Klimaziele erreichen - Ausbau Fernwärme Netz in Durlach:
> Gremium Termin TOP ö nö Ortschaftsrat Durlach 19.04.2023 9 x Die Fernwärme ist eines der größten Umweltprojekte in Karlsruhe. Durch die Nutzung werden in Karlsruhe weit mehr als 100.000 t CO 2 eingespart. Das Interesse der Karlsruher Bürger\*innen an der umweltfreundlichen Fernwärme der Stadtwerke Karlsruhe ist sehr hoch, und es sind bereits ca. 30 Wohn- und Geschäftsgebäude mit einer thermischen Leistung von insgesamt 14,72 MW bzw. 14.175 kW (Stand 12/2022) im Stadtteil Durlach an das Fernwärmenetz angeschlossen. Auch aufgrund der aktuellen und geplanten Gesetze zur Wärmeversorgung von Gebäuden ist die Nachfrage ungebrochen. Die hohe Nachfrage führte mittlerweile dazu, dass das Netz in Durlach inzwischen an seiner Kapazitätsgrenze angelangt ist. Um die Kapazitätsgrenze in Durlach deutlich anzuheben, beabsichtigen die Stadtwerke eine zweite Fernwärme-Versorgungsleitung nach Durlach zu bauen und gegebenenfalls die bestehende zu vergrößern. Die entsprechenden Planungen dazu sind angestoße…


</details>

### 50342: Erweiterung der Geschwindigkeitsbegrenzung auf 30 km/h über die Kreuzung Rittnertstraße/Hotzerweg

<details><summary>Original query sources</summary>


[Paper record](../../../docs/papers/50342.json)
- Antrag Erweiterung der Geschwindigkeitsbegrenzung: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00657697.pdf>) · [extracted text](../../../docs/file-contents/657697.txt)
- Stellungnahme Erweiterung der Geschwindigkeitsbegrenzung: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00658398.pdf>) · [extracted text](../../../docs/file-contents/658398.txt)

Original content section — Antrag Erweiterung der Geschwindigkeitsbegrenzung:
> Gedruckt auf 100 Prozent Recyclingpapier Vorlage Nr.: 2024/0452 Eingang: 16.04.2024 Erweiterung der Geschwindigkeitsbegrenzung auf 30 km/h über die Kreuzung Rittnertstraße/Hotzerweg CDU-OR-Fraktion Antrag: Erweiterung der Geschwindigkeitsbegrenzung von 30 Km/h über die Kreuzung Rittnertstraße/Hotzerweg für eine bessere Sichtbarkeit und klarere Abgrenzung der Bereiche Tempo 30 und 50. Begründung: In der Rittnertstraße wurde in der Vergangenheit Tempo 30 angeordnet und entsprechend eingerichtet. Hier wurde der Beginn der Geschwindigkeitsbegrenzung in Richtung Durlach innerhalb einer Bushaltestelle gesetzt. In Richtung Thomashof endet Tempo 30 erst nach der Kreuzung Rittnertstraße/Hotzerweg. Durch eine Erweiterung um ca. 30 Meter der (Siehe Bild) Geschwindigkeitsbegrenzung würde sich eine einheitliche Grenze von Tempo 30 auf 50 Km/h bzw. umgekehrt ergeben. Zudem würde dies auch die Sicherheit aller Verkehrsteilnehmer im gesamten Kreuzungsbereich besonders für abbiegende Fahrradfahrer erge…


</details>

- 0.217780 · t (assistant) · 38105: Lärmaktionsplanung: Tempo 30 ganztägig: Zeppelin- und Rittnertstraße

- 0.197782 · t (assistant) · 38110: Lärmaktionsplan: Straßenlärm in der Rittnertstraße in Durlach

- 0.146658 · t (assistant, follow-up review) · 24272: Antrag B‘90/Die Grünen-OR-Fraktion: Lärm-/ Verkehrssituation Rittnertstraße

<details><summary>Original candidate sources</summary>


[Paper record](../../../docs/papers/24272.json)
- TOP 6, Antrag: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00003898.pdf>) · [extracted text](../../../docs/file-contents/3898.txt)
- TOP 6, STELLUNGNAHME: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00003899.pdf>) · [extracted text](../../../docs/file-contents/3899.txt)

Original content section — TOP 6, Antrag:
> Die Verwaltung wird beauftragt, unverzüglich auch für die Rittnertstraße eine Geschwindigkeitsbeschränkung auf Tempo 30 in den Nachtstunden beim Regierungspräsidium zu beantragen. In den Bereichen der Rittnertstraße, in welchen der Niveauunterschied zwischen Fahrbahn und Bordstein nur noch gering vorhanden ist, soll eine durchgezogene Linie das Befahren des Gehweges für den fließenden Verkehr „sichtbar“ untersagen.

Passage sharing title words (context only) — TOP 6, Antrag:
> B‘90/Die Grünen-OR-Fraktion vom: 03.01.2010 Gremium: Termin: TOP: Verantwortlich: Ortschaftsrat Durlach 24.02.10 6 öffentlich Bürgerservice und Sicherheit Lärm-/ Verkehrssituation Rittnertstraße Bei der Vorstellung der Lärmkartierung Durlach im OR am 24. September 2008 wurde von der Verwaltung festgestellt, dass: „In der Ortsdurchfahrt B 3 (im Bereich der Marstallstraße und Grötzingerstraße) und der Rittnertstraße bei einer Geschwindigkeitsreduzierung auf 30 km/h (in der Nacht) Entlastungen um knapp 3 dBA erreicht werden könnten.“ Bei der Sitzung des OR Durlach am 10.12.2008 wurde mitgeteilt, dass bei einer möglichen Minderung des Lärmpegels um mindestens 2,1dBA eine Geschwindigkeitsreduzier…


</details>

### 50363: Rückerwerb von 1/10 Anteil der SBV Immobilienverwaltung am Marktplatz an dem Erbbaurecht an dem Grundstück Nr. 1290 mit 2.384 m², Gebäude- und Freifläche, Kaiserstraße 145, Karl-Friedrich-Straße 8, Lammstraße 7, Zähringer Straße 96

<details><summary>Original query sources</summary>


[Paper record](../../../docs/papers/50363.json)
- Beschlussvorlage: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00657933.pdf>) · [extracted text](../../../docs/file-contents/657933.txt)

Original Kurzfassung — Beschlussvorlage:
> 1. Der Gemeinderat nimmt nach Vorberatung im Hauptausschuss die Ausführungen zur Kenntnis und stimmt dem Rückerwerb des Erbbaurechts der SBV Immobilienverwaltung am Marktplatz am Grundstück Flst. Nr. 1290 zum Rückerstattungspreis von 2.505.330 Euro zu. 2. Das Liegenschaftsamt wird ermächtigt, alles Weitere zu veranlassen und entsprechende Erklärungen, die zur Entlassung der SBV Immobilienverwaltung am Marktplatz aus dem Erbbaurecht und der Auflösung desselben erforderlich sind, abzugeben.


</details>

- 0.129505 · s (assistant, follow-up review) · 47961: Zukünftige Nutzung der Räumlichkeiten der Sparkasse am Marktplatz

<details><summary>Original candidate sources</summary>


[Paper record](../../../docs/papers/47961.json)
- Anfrage: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00643558.pdf>) · [extracted text](../../../docs/file-contents/643558.txt)
- Stellungnahme Anfrage: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00644096.pdf>) · [extracted text](../../../docs/file-contents/644096.txt)

Original content section — Anfrage:
> Gedruckt auf 100 Prozent Recyclingpapier AfD-Gemeinderatsfraktion Eingang: 20.12.2022 Vorlage Nr.: 2022/2471 Zukünftige Nutzung der Räumlichkeiten der Sparkasse am Marktplatz Gremium Termin TOP ö nö Gemeinderat 24.01.2023 28 x Die Verwaltung wird um Auskunft gebeten, welche Nutzung für die Räume der Sparkasse am Marktplatz vorgesehen sind. Sachverhalt/Begründung Die Sparkasse Karlsruhe beabsichtigt, ihre Räumlichkeiten im Technischen Rathaus am Marktplatz aufzugeben. Es wird wohl nur noch ein Automatenbereich benötigt werden. Sollen die freiwerdenden Räume zukünftig durch die Stadtverwaltung genutzt oder einer kommerziellen Nutzung zugeführt werden? Es ist im Interesse der Bürger zu erfahren, was dem städtischen Gebäude in dieser exponierten Lage geschehen soll. Unterzeichnet von: Dr. Paul Schmidt Oliver Schnell Ellen Fenrich

Passage sharing title words (context only) — Stellungnahme Anfrage:
> ie alle wesentlichen Anforderungen an ein zentrales Briefwahlbüro in der Innenstadt erfüllt. Das Briefwahlbüro der Stadt Karlsruhe ist derzeit in einem ehemaligen Ladengeschäft im Gebäude „Kriegsstraße 100“ untergebracht. Das dort bestehende Mietverhältnis hat noch eine Laufzeit bis 2025. Ein langfristiger Verbleib des Briefwahlbüros ist nicht möglich, da an diesem Standort seitens des Eigentümers eine Immobilienentwicklung vorgesehen ist. Es wurden bereits erste Gespräche mit der Sparkasse Karlsruhe geführt. Die Sparkasse beabsichtigt, ihre SB-Automaten im Foyer am Marktplatz weiter zu betreiben. Dieser Eingangsbereich würde dann als ein gemeinsamer Zugang für die Kunden der Sparkasse und f…


</details>

- 0.092431 · **new, unreviewed** · 39695: Bestellung eines Erbbaurechts an den städtischen Grundstücken Nrn 8545/37 und Nr. 8545/45 (ehemals L'Oréal), Greschbachstraße 5 und 5 d (Stadtteil Grötzingen), zugunsten der Firma Pfeiffer & May Karlsruhe GmbH, Unterweingartenfeld 2, 76135 Karlsruhe, · below threshold

<details><summary>Original candidate sources</summary>


[Paper record](../../../docs/papers/39695.json)
- Loreal: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00620021.pdf>) · [extracted text](../../../docs/file-contents/620021.txt)
- Loreal Lageplan: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00620020.pdf>) · [extracted text](../../../docs/file-contents/620020.txt)

Original content section — Loreal:
> Der Gemeinderat genehmigt nach Vorberatung im Hauptausschuss die Bestellung eines Erbbaurechts an oben genannten städtischen Grundstücken zugunsten der Firma Pfeiffer & May Karlsruhe GmbH, Unterweingartenfeld 2, 76135 Karlsruhe zu nachfolgenden Vertragskonditionen: • Verkauf der vorhandenen Gebäude nebst Betriebsvorrichtungen (150.000,00 Euro) zum Preis von insgesamt 9.600.000,00 Euro als Gegenstand des Erbbaurechts • Die Laufzeit des Erbbaurechts beträgt 25 Jahre • Einmalzahlung i.H.v 4.341.000,00 € des Erbbauzinses nebst Nutzungsentgelt für die gesamte Vertragslaufzeit (25 Jahre) unter Berücksichtigung der voraussichtlichen Inflationsrate auf Basis des Verbraucherpreisindex Baden-Württemberg • Entschädigung bei Heimfall und bei Laufzeitende: 2/3 des Verkehrswertes der Gebäude Das Liegenschaftsamt wird ermächtigt, den entsprechenden Erbbauvertrag abzuschließen und er- forderliche Erklärungen zur Belastung des Erbbaurechts mit Grundpfandrechten abzugeben, die der Sicherung von Baudarle…


</details>

- 0.091400 · **new, unreviewed** · 362: Änderungsantrag: FÜR Karlsruhe: Vergabe von Grundstücken der Stadt und ihrer Gesellschaften grundsätzlich im Erbbaurecht statt Verkauf · below threshold

<details><summary>Original candidate sources</summary>


[Paper record](../../../docs/papers/362.json)
- Änderungsantrag: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00608971.pdf>) · [extracted text](../../../docs/file-contents/608971.txt)

Original content section — Änderungsantrag:
> Die Verwaltung schlägt unter Ziffer 4 den Versuch vor, die ausschließliche Bestellung von Erb- baurechten für ein bestimmtes Baugebiet oder auch ein größeres Geschosswohnungsbaugrund- stück zu testen. unterzeichnet: Friedemann Kalmbach Eduardo Mossuto

Passage sharing title words (context only) — Änderungsantrag:
> at Friedemann Kalmbach (FÜR Karlsruhe) Stadtrat Eduardo Mossuto (FÜR Karlsruhe) Vorlage Nr.: 2019/0376 Vergabe von Grundstücken der Stadt und ihrer Gesellschaften grundsätzlich im Erbbaurecht statt Verkauf Gremium Termin TOP ö nö Gemeinderat 09.04.2019 10 x Punkt 1 sollte wie folgt geändert werden: 1. Der Gemeinderat beschließt, weiterhin sowohl das Erbbaurecht als auch den Verkauf strategisch zu nutzen und – als Weiterentwicklung der bisherigen Handhabung – gemäß der in den ergänzenden Erläuterungen unter Ziffer 4 dargestellten Vorgehensweise speziell bei zusammenhängenden Gebieten sich ausschließlich für den Erbbaurecht zu entscheiden. Begründung Die Verwaltung schlägt unter Ziffer 4 den V…


</details>

### 50436: Bebauungsplanverfahren „Durlacher Allee, Güterumgehungsbahn Karlsruhe 4210, Durlacher Allee 106 (Alter Gleisbauhof) und Ostring", Oststadt

<details><summary>Original query sources</summary>


[Paper record](../../../docs/papers/50436.json)
- Beschlussvorlage: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00658379.pdf>) · [extracted text](../../../docs/file-contents/658379.txt)
- Anlage 2 Aufstellungsbeschluss Übersicht: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00658497.pdf>) · [extracted text](../../../docs/file-contents/658497.txt)
- Anlage 1 Ostring-Durlacher Allee-DB: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00658498.pdf>) · [extracted text](../../../docs/file-contents/658498.txt)

Original Kurzfassung — Beschlussvorlage:
> 1. Der Planungsausschuss beschließt gemäß §2 Absatz 1 BauGB den Bebauungsplan „Durlacher Allee, Güterumgehungsbahn Karlsruhe 4210, Durlacher Allee 106 (Alter Gleisbauhof) und Ostring“ aufzustellen. Maßgebend für die Abgrenzung des Plangebietes ist der beiliegende Lageplan des Stadtplanungsamtes/Liegenschaftsamtes im Maßstab 1:2000 vom 13.05.2024. 2. Der Planungsausschuss beschließt, die frühzeitige Beteiligung der Öffentlichkeit gemäß § 3 Abs. 1 BauGB als Information auf der Webseite der Stadtverwaltung vorzunehmen.


</details>

- 0.165354 · t (assistant) · 49778: Planungswerkstatt Stadteingang Ost/Südseite der Durlacher Allee

- 0.149009 · t (assistant, follow-up review) · 36780: Vorhabenbezogener Bebauungsplan mit Vorhaben- und Erschließungsplan "Ecke Durlacher Allee - Tullastraße (ehemaliger VBK Betriebshof), Karlsruhe-Oststadt: Satzungsbeschluss gemäß § 10 des Baugesetzbuches (BauGB)

<details><summary>Original candidate sources</summary>


[Paper record](../../../docs/papers/36780.json)
- TOP 6 Satzungsbeschluss Tullastraße VBK: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00606365.pdf>) · [extracted text](../../../docs/file-contents/606365.txt)
- Anlage 1 BPlan Tullastraße: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00606334.pdf>) · [extracted text](../../../docs/file-contents/606334.txt)
- Anlage BPlan AVG Tullastraße\_mA: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00606335.pdf>) · [extracted text](../../../docs/file-contents/606335.txt)

Original content section — TOP 6 Satzungsbeschluss Tullastraße VBK:
> Satzungsbeschluss zum Bebauungsplan als Abschluss des Verfahrens (Beschluss mit vollständi- gem Wortlaut auf Seite 7). Finanzielle Auswirkungen Gesamtkosten der Maß- nahme Einzahlungen/Erträge (Zuschüsse u. Ä.) Jährliche laufende Belastung (Folgekosten mit kalkulatorischen Kosten abzügl. Fol- geerträge und Folgeeinsparungen) Ja Nein Haushaltsmittel sind dauerhaft im Budget vorhanden Ja Nein Die Finanzierung wird auf Dauer wie folgt sichergestellt und ist in den ergänzenden Erläuterungen auszuführen: Durch Wegfall bestehender Aufgaben (Aufgabenkritik) Umschichtungen innerhalb des Dezernates Der Gemeinderat beschließt die Maßnahme im gesamtstädtischen Interesse und stimmt einer Etatisierung in den Folgejahren zu x Nein Ja Korridorthema: Anhörung Ortschaftsrat (§ 70 Abs. 1 GemO) x Nein Ja durchgeführt am Abstimmung mit städtischen Gesellschaften x Nein Ja abgestimmt mit Ergänzende Erläuterungen Seite 2 I. Erläuterungen zur Planung Die Planung ist aktueller Teil der städtebaulichen Umstruk…

Passage sharing title words (context only) — Anlage 1 BPlan Tullastraße:
> Anlage 1 Vorhabenbezogenes Bebauungsplanverfahren „Ecke Durlacher Allee – Tullastra- ße (ehemaliger VBK Betriebshof)“, Karlsruhe - Oststadt hier: Beteiligung der Behörden im Rahmen der Öffentlichen Auslegung (9. Juli bis 10. August 2018) Inhaltsverzeichnis: Bundesnetzagentur vom 09.07.2018 ........................................................................... 1 Nachbarschaftsverband Karlsruhe vom 09.07.2018 ...................................................... 2 ZJD Wasserbehörde vom 30.07.2018 ........................................................................... 2 Bürgerverein der Oststadt vom 10.08.2018 .................................................................. 3 BUND v…


</details>

- 0.145066 · t (assistant) · 26728: Interfraktioneller Antrag FDP, KAL: Entwicklungsachse Durlacher Allee/Stadteingang Ost

### 50450: Transparenz in der Umsetzung des Rechtsanspruchs für Grundschulkinder Forderung nach FAQ zum Schulkind-Bildungs- und Betreuungssystem (SKIBB)

<details><summary>Original query sources</summary>


[Paper record](../../../docs/papers/50450.json)
- Antrag: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00658503.pdf>) · [extracted text](../../../docs/file-contents/658503.txt)
- Stellungnahme Antrag: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00658872.pdf>) · [extracted text](../../../docs/file-contents/658872.txt)

Original content section — Antrag:
> Gedruckt auf 100 Prozent Recyclingpapier Vorlage Nr.: 2024/0548 Eingang: 15.05.2024 Transparenz in der Umsetzung des Rechtsanspruchs für Grundschulkinder Forderung nach FAQ zum Schulkind-Bildungs- und Betreuungssystem (SKIBB) Antrag: SPD Die Stadtverwaltung informiert transparent über die weiteren Schritte zur Umsetzung des Rechtsanspruchs für Kinder im Grundschulalter. Hierfür wird ein FAQ zum geplanten Schulkind- Bildungs- und Betreuungssystem (SKIBB) erstellt, damit für alle Interessierten die Schritte der Umsetzung des Rechtsanspruchs auf Betreuung für Kinder im Grundschulalter transparent auf der städtischen Homepage einsehbar sind. Begründung/Einordnung: Die Erstellung eines FAQs zum geplanten Schulkind-Bildungs- und Betreuungssystem (SKIBB) durch die Stadtverwaltung dient der Transparenz und erleichtert Eltern und anderen Beteiligten den Zugang zu wichtigen Informationen. Für die betroffenen Eltern sind Planungssicherheit und Transparenz von großer Bedeutung. In vielen Gespräche…


</details>

- 0.243290 · s (assistant) · 50002: Schulkind-Bildungs- und Betreuungssystem (SKiBB)

- 0.240633 · s (assistant, follow-up review) · 52213: Neukonzeption der Schulkindbetreuung zum Schuljahr 2026/27 in Verbindung mit dem Ganztagsförderungsgesetz (GaFöG): Das Schulkind- Bildungs- und Betreuungssystem (SKiBB)

<details><summary>Original candidate sources</summary>


[Paper record](../../../docs/papers/52213.json)
- Änderungs-/Ergänzungsantrag: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00669095.pdf>) · [extracted text](../../../docs/file-contents/669095.txt)
- Stellungnahme Antrag: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00669117.pdf>) · [extracted text](../../../docs/file-contents/669117.txt)

Original content section — Änderungs-/Ergänzungsantrag:
> Die Umsetzung des Rechtsanspruchs auf Ganztagesförderung in Grundschulen ab dem Schuljahresbeginn 2026/2027 rückt näher. Insofern gilt es, den Ausbau der notwendigen baulichen Infrastruktur noch stärker zu forcieren. Darüber hinaus ist eine starre Festlegung auf Variante 1 irreführend, weil sie bei Eltern berechtigterweise viel zu hohe Erwartungen weckt, die die Stadt zum Schuljahresbeginn 2026/2027 weder finanziell und infrastrukturell noch personell erfüllen kann. Um solch hohe Erwartungen daher nicht zu enttäuschen und um etwaige Regressforderungen zu vermeiden, soll keine Festlegung auf eine Variante erfolgen, die ab dem Schuljahresbeginn 2026/2027 zu gelten hätte. Vielmehr sollen die guten Vorgaben der Variante 1 in der Beschlussvorlage als Prozess oder als Ziel verstanden werden, auf das sich der Ausbau der Ganztagesbetreuung zubewegen soll. Bis dahin soll der Istzustand Grundlage der Ganztagesbetreuung bleiben. Unterzeichnet von: Stadtrat Detlef Hofmann Stadträtin Bettina Meier-…

Passage sharing title words (context only) — Stellungnahme Antrag:
> Stellungnahme zum Antrag Gedruckt auf 100 Prozent Recyclingpapier Vorlage Nr.: 2025/0392/2 Verantwortlich: Dez. 3 Dienststelle: Schul- und Sportamt Neukonzeption der Schulkindbetreuung zum Schuljahr 2026/27 in Verbindung mit dem Ganztagsförderungsgesetz (GaFöG): Das Schulkind- Bildungs- und Betreuungssystem (SKiBB): Der Weg ist das Ziel: Vorgaben für den Ganztag als Prozess verstehen Änderungsantrag: CDU Gemeinderat 29.07.2025 14.1 Ö Entscheidung Jugendhilfeausschuss 15.10.2025 Ö Kenntnisnahme Kurzfassung Die vorgeschlagene Haltung, aufgrund aktueller Herausforderungen keine verbindliche Entscheidung zur Ausgestaltung des kommenden Rechtsanspruchs auf Ganztagesförderung zu treffen, würde der…


</details>

- 0.236059 · s (assistant) · 41582: Strategie: Rechtsanspruch auf ganztägige Bildungs- und Betreuungsangebote für Grundschulkinder ab dem Schuljahr 2026/27

### 50618: Wahl gemeinderätlicher Ausschussmitglieder

<details><summary>Original query sources</summary>


[Paper record](../../../docs/papers/50618.json)
- Beschlussvorlage: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00659591.pdf>) · [extracted text](../../../docs/file-contents/659591.txt)
- Anlage 1 Ältestenrat: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00659592.pdf>) · [extracted text](../../../docs/file-contents/659592.txt)
- Anlage 2 Haupt- und Finanzausschuss: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00659593.pdf>) · [extracted text](../../../docs/file-contents/659593.txt)
- Anlage 3 Bauausschuss: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00659594.pdf>) · [extracted text](../../../docs/file-contents/659594.txt)
- Anlage 4 Planungsausschuss: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00659595.pdf>) · [extracted text](../../../docs/file-contents/659595.txt)
- Anlage 5 Jugendhilfeausschuss: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00659596.pdf>) · [extracted text](../../../docs/file-contents/659596.txt)
- Anlage 6 Umlegungsausschuss: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00659597.pdf>) · [extracted text](../../../docs/file-contents/659597.txt)
- Anlage 7 Bäderausschuss: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00659598.pdf>) · [extracted text](../../../docs/file-contents/659598.txt)
- Anlage 8 Personalausschuss: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00659599.pdf>) · [extracted text](../../../docs/file-contents/659599.txt)
- Anlage 9 Betriebsausschuss Fußballstadion im Wildpark: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00659600.pdf>) · [extracted text](../../../docs/file-contents/659600.txt)
- Anlage 10 Betriebsausschuss Abfallwirtschaft und Stadtreinigung: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00659601.pdf>) · [extracted text](../../../docs/file-contents/659601.txt)
- Anlage 11 Ausschuss für öffentliche Einrichtungen: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00659602.pdf>) · [extracted text](../../../docs/file-contents/659602.txt)
- Anlage 12 Ausschuss für Umwelt und Gesundheit: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00659603.pdf>) · [extracted text](../../../docs/file-contents/659603.txt)
- Anlage 13 Ausschuss für Wirtschaft und Wissenschaft: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00659604.pdf>) · [extracted text](../../../docs/file-contents/659604.txt)
- Anlage 14 Kulturausschuss: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00659605.pdf>) · [extracted text](../../../docs/file-contents/659605.txt)
- Anlage 15 Sportausschuss: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00659606.pdf>) · [extracted text](../../../docs/file-contents/659606.txt)
- Anlage 16 Integrationsausschuss: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00659607.pdf>) · [extracted text](../../../docs/file-contents/659607.txt)
- Anlage 17 Sozialausschuss: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00659608.pdf>) · [extracted text](../../../docs/file-contents/659608.txt)
- Anlage 18 Schulausschuss: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00659609.pdf>) · [extracted text](../../../docs/file-contents/659609.txt)

Original Kurzfassung — Beschlussvorlage:
> Der Gemeinderat beschließt einvernehmlich über die Zusammensetzung des Ältestenrats und der Ausschüsse entsprechend den Anlagen Nr. 1 bis 18.


</details>

### 50746: Bestellung der Mitglieder des Sanierungsbeirates Grötzingen

<details><summary>Original query sources</summary>


[Paper record](../../../docs/papers/50746.json)
- Beschlussvorlage: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00659716.pdf>) · [extracted text](../../../docs/file-contents/659716.txt)
- 2024-09-24 top3-17: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00661171.pdf>)

Original Kurzfassung — Beschlussvorlage:
> Nach jeder Gemeinderatswahl werden die Mitglieder des Sanierungsbeirats Grötzingen neu gewählt.


</details>

### 50858: Zweckverband für die Wasserversorgung des Hügellandes zwischen Alb und Pfinz: Wahl der Vertreterinnen und Vertreter der Stadt Karlsruhe in der Verbandsversammlung

<details><summary>Original query sources</summary>


[Paper record](../../../docs/papers/50858.json)
- GR Vorlage\_WasserV\_Alb-Pfinz-Hügelland\_2024: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00660282.pdf>) · [extracted text](../../../docs/file-contents/660282.txt)
- 2024-09-24 top5: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00661196.pdf>)

Original Kurzfassung — GR Vorlage\_WasserV\_Alb-Pfinz-Hügelland\_2024:
> Der Gemeinderat wählt sieben Vertreter bzw. Vertreterinnen der Stadt Karlsruhe in die Verbandsversammlung des Zweckverbandes für die Wasserversorgung des Hügellandes zwischen Alb und Pfinz sowie deren Stellvertreter bzw. Stellvertreterinnen (Beschluss mit vollständigem Wortlaut siehe Seite 2).


</details>

- 0.793922 · t (assistant) · 37628: Zweckverband für die Wasserversorgung des Hügellandes zwischen Alb und Pfinz: Bestellung der Vertreterinnen und Vertreter der Stadt Karlsruhe in der Verbandsversammlung

- 0.741939 · t (assistant) · 47750: Vorschlag des Ortschaftsrates Wettersbach zur Wahl von Frau Ortsvorsteherin Tron als Vertreterin der Stadt Karlsruhe in der Verbandsversammlung für die Wasserversorgung des Hügellandes zwischen Alb und Pfinz

- 0.729258 · t (assistant) · 33932: Bestellung der Vertreter und Vertreterinnen der Stadt Karlsruhe in den Zweckverband für die Wasserversorgung des Hügellandes zwischen Alb und Pfinz

### 50879: Verpflichtung der neu- und wiedergewählten Ortschaftsrätinnen und Ortschafsträte

<details><summary>Original query sources</summary>


[Paper record](../../../docs/papers/50879.json)
- TOP\_1\_1\_Verpflichtung\_gewählte\_OR: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00660365.pdf>) · [extracted text](../../../docs/file-contents/660365.txt)

Original Kurzfassung — TOP\_1\_1\_Verpflichtung\_gewählte\_OR:
> Die neu– und wiedergewählten Ortschaftsräte sind nach § 32 Abs. 1 der Gemeindeordnung in der ers- ten Sitzung durch den ältesten Ortschaftsrat oder die älteste Ortschaftsrätin des neuen Gremiums öf- fentlich auf die gewissenhafte Erfüllung ihrer Amtspflichten zu verpflichten. Die Verpflichtungsformel lautet: „Ich gelobe Treue der Verfassung, Gehorsam den Gesetzen und gewissenhafte Erfüllung meiner Pflichten. Insbesondere gelobe ich, die Rechte der Stadt Karlsruhe und des Stadtteils Neureut gewissenhaft zu wahren und ihr Wohl und das ihrer Einwohner nach Kräften zu för- dern. Danach sollen die Gewählten die Verpflichtung durch die gesprochenen Worte „Ich gelobe es, so wahr mir Gott helfe.“ oder: „Ich gelobe es.“ bekräftigen. Anschließend wird den Verpflichteten durch das älteste Ortschaftsratsmitglied der Handschlag abge- nommen und von ihnen eine entsprechende Niederschrift über die Verpflichtung unterschrieben.


</details>

### 51275: Fortführung der ergänzenden Vereinbarung zum KVV-Gesellschaftsvertrag über die Finanzierung der Verbundorganisation sowie der verbundbedingten Lasten des KVV für die Jahre 2025 und 2026

<details><summary>Original query sources</summary>


[Paper record](../../../docs/papers/51275.json)
- Beschlussvorlage: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00662904.pdf>) · [extracted text](../../../docs/file-contents/662904.txt)
- Anlage Entwurf Ergänzungsvereinbarung: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00662903.pdf>) · [extracted text](../../../docs/file-contents/662903.txt)

Original Kurzfassung — Beschlussvorlage:
> Der Gemeinderat ist mit der Fortführung der ergänzenden Vereinbarung zum KVV Gesellschaftsvertrag über die Finanzierung der Verbundorganisation sowie der verbundbedingten Lasten des KVV für die Jahre 2025 und gegebenenfalls 2026 einverstanden und stimmt dem Abschluss der als Anlage im Entwurf beigefügten Vereinbarung durch den städtischen Vertreter in der Gesellschafterversammlung der Karlsruher Verkehrsverbund GmbH (KVV) zu. Der Gemeinderat ist damit einverstanden, dass noch Anpassungen der Vereinbarung, welche nicht grundsätzlicher Art sind, vorgenommen werden dürfen.


</details>

- 0.936904 · s (assistant) · 47903: Fortführung der ergänzenden Vereinbarung zum KVV-Gesellschaftsvertrag über die Finanzierung der Verbundorganisation sowie der verbundbedingten Lasten des KVV für die Jahre

- 0.729172 · s (assistant) · 36572: Fortführung der ergänzenden Vereinbarung zum KVV-Gesellschaftsvertrag über die Finanzierung der Verbundorganisation sowie der verbundbedingten Lasten des KVV für die Jahre 2019 und 2020

- 0.728353 · s (assistant) · 40137: Fortführung der ergänzenden Vereinbarung zum KVV-Gesellschaftsvertrag über die Finanzierung der Verbundorganisation sowie der verbundbedingten Lasten des KVV für die Jahre 2021 und 2022

### 51278: Auswirkungen eines fehlenden Bundeshaushaltes auf Karlsruhe

<details><summary>Original query sources</summary>


[Paper record](../../../docs/papers/51278.json)
- Anfrage: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00662907.pdf>) · [extracted text](../../../docs/file-contents/662907.txt)
- Stellungnahme Anfrage: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00663220.pdf>) · [extracted text](../../../docs/file-contents/663220.txt)

Original content section — Anfrage:
> Gedruckt auf 100 Prozent Recyclingpapier Vorlage Nr.: 2024/1320 Eingang: 18.11.2024 Auswirkungen eines fehlenden Bundeshaushaltes auf Karlsruhe Gemeinsame Anfrage: FÜR, Volt 1. Der nicht beschlossene Nachtragshaushalt 2024 sah vor allem Investitionen für laufende Projekte für den Klimaschutz, der Digitalisierung oder der Verkehrsinfrastruktur vor. Wie stark ist Karlsruhe in diesen Bereichen von Bundesfördermitteln abhängig, und welche Projekte wären von Verzögerungen betroffen? 2. Welche Auswirkungen haben ausbleibende Bundesmittel auf geplante Investitionen in Bildungseinrichtungen oder soziale Infrastruktur in Karlsruhe? 3. Welche Auswirkungen haben ausbleibende Bundesmittel auf soziale Programme, wie etwa Jugend- oder Integrationsarbeit? 4. Welche Maßnahmen plant die Stadt Karlsruhe, um mögliche finanzielle Engpässe zu überbrücken, falls die Bundesmittel länger ausbleiben? 5. Welche wesentlichen Auswirkungen hat die Neuterminierung der Bundestagswahl auf die Ressourcen der Stadtverw…


</details>

- 0.075366 · t (assistant) · 54094: Verwendung der Fördermittel aus dem Länder-und-Kommunal-Infrastrukturfinanzierungsgesetz (LuKIFG) · below threshold

- 0.068392 · **new, unreviewed** · 48856: Bundesförderung für die Sanierung kommunaler Einrichtungen in den Bereichen Sport, Jugend und Kultur · below threshold

<details><summary>Original candidate sources</summary>


[Paper record](../../../docs/papers/48856.json)
- Anfrage: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00650009.pdf>) · [extracted text](../../../docs/file-contents/650009.txt)
- Stellungnahme zur Anfrage: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00650328.pdf>) · [extracted text](../../../docs/file-contents/650328.txt)
- Anlage zur Anfrage, sanierung-kommunaler-einrichtungen-sjk-2023-aufruf-dl: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00648754.pdf>) · [extracted text](../../../docs/file-contents/648754.txt)

Original content section — Anfrage:
> Gedruckt auf 100 Prozent Recyclingpapier Vorlage Nr.: 2023/0763 Eingang: 05.07.2023 Bundesförderung für die Sanierung kommunaler Einrichtungen in den Bereichen Sport, Jugend und Kultur Anfrage: GRÜNE Gremium Termin Öffentlichkeitsstauts Zuständigkeit Gemeinderat 19.09.2023 öffentlich Kenntnisnahme 1. Meldet die Stadtverwaltung Karlsruhe Projekte an zum aktuellen Förderaufruf „Sanierung kommunaler Einrichtungen in den Bereichen Sport, Jugend und Kultur“? 2. Welche der aktuell in Karlsruhe geplanten Projekte erfüllen die hierfür nötigen Förderkriterien? 3. Können bereits begonnene Vorhaben zur Förderung angemeldet werden? Falls ja, welche von diesen würden die Kriterien erfüllen? 4. Welche der Investitionsprojekte auf der Tränenliste bzw. Prioritätenliste 2 erfüllen die Förderkriterien? Sachverhalt / Begründung Laut Pressemitteilung des Bundesinstitutes Bau-, Stadt- und Raumforschung vom 19.Juni 2023 können Kommunen bis zum 15. September 2023 ihr Interesse an Förderungen über das Program…


</details>

- 0.066313 · **new, unreviewed** · 21727: Änderungsantrag GRÜNE: Konjunkturprogramme des Bundes und des Landes · below threshold

<details><summary>Original candidate sources</summary>


[Paper record](../../../docs/papers/21727.json)
- GRÜNE-Konjunkturprogramme: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00038098.pdf>) · [extracted text](../../../docs/file-contents/38098.txt)
- TOP 18 GRÜNE: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00038099.pdf>) · [extracted text](../../../docs/file-contents/38099.txt)

Original opening — GRÜNE-Konjunkturprogramme:
> STADT KARLSRUHE Der Oberbürgermeister ÄNDERUNGSANTRAG Stadträtin Bettina Lisbach (GRÜNE) Stadträtin Sabine Just-Höpfinger (GRÜNE) GRÜNE-Gemeinderatsfraktion vom 27. Januar 2009 Gremium: Termin: Vorlage Nr.: TOP: 58. Plenarsitzung Gemeinderat 27.01.2009 1663 18 öffentlich Konjunkturprogramme des Bundes und des Landes 1. Die städtischen Gesellschaften werden gebeten, analog den beantragten Aktivitäten der Stadtverwaltung Maßnahmen zu ergreifen, um ebenfalls Projekte im Rahmen der Konjunkturprogramme des Bundes und des Landes auf den Weg bringen zu können. 2. Die Entscheidung, mit welcher Priorität Projekte beantragt werden, obliegt dem Gemeinderat. Der größte Teil städtischer Investitionsaktivitäten spielt sich mittlerweile in den städtischen Gesellschaften ab. Gerade im Bereich Klinikum (Gebäudesanierung u. a.), Stadtwerke (umweltfreundliche Stromerzeugung) oder ÖPNV (umweltfreundliche Mobilität, Erweiterung des Schienennetzes zur weiteren Anbindung von Stadtteilen) sehen wir große Pote…

Passage sharing title words (context only) — TOP 18 GRÜNE:
> Maximum an Projekten in ihren jeweiligen Wirtschaftsplänen ein- gestellt haben. Die Entscheidung über zusätzliche Investitionen obliegt den dafür zuständigen Gremien. Finanzielle Auswirkungen nein ja Gesamtaufwand der Maßnahme Einnahmen (Zuschüsse u. Ä.) Finanzierung durch städtischen Haushalt Jährliche laufende Belastung (Folgekosten mit kalkulatori- schen Kosten abzügl. Folgeer- träge und Folgeeinsparungen) nicht bezifferbar Haushaltsmittel stehen nicht zur Verfügung. Finanzposition: Ergänzende Erläuterungen: Karlsruhe Masterplan 2015 - relevant nein ja Handlungsfeld: Anhörung Ortschaftsrat (§ 70 Abs. 1 GemO) nein ja durchgeführt am Abstimmung mit städtischen Gesellschaften nein ja abgest…


</details>

### 51361: Annahme des Angebots von Zuwendungen

<details><summary>Original query sources</summary>


[Paper record](../../../docs/papers/51361.json)
- Beschlussvorlage: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00663684.pdf>) · [extracted text](../../../docs/file-contents/663684.txt)

Original Kurzfassung — Beschlussvorlage:
> Der Haupt- und Finanzausschuss nimmt Kenntnis von den in der Anlage aufgeführten Zuwendungsangeboten und beschließt die Annahme der angebotenen Zuwendungen.


</details>

### 51425: Erneuerung des Treppenwegs zum Turmberg

<details><summary>Original query sources</summary>


[Paper record](../../../docs/papers/51425.json)
- Antrag Erneuerung des Treppenwegs zum Turmberg: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00664016.pdf>) · [extracted text](../../../docs/file-contents/664016.txt)
- Stellungnahme Erneuerung des Treppenwegs zum Turmberg: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00664490.pdf>) · [extracted text](../../../docs/file-contents/664490.txt)

Original content section — Antrag Erneuerung des Treppenwegs zum Turmberg:
> Gedruckt auf 100 Prozent Recyclingpapier Vorlage Nr.: 2025/0011 Eingang: 07.01.2025 Erneuerung des Treppenwegs zum Turmberg AfD-OR-Fraktion Sachverhalt: Das im Jahr 1781 angelegte "Hexenstäffele" ist ein Treppenweg, der in 528 Stufen von der Posseltstraße aus direkt zum Turmberg-Plateau führt. Quelle: https://ka.stadtwiki.net/Hexenst%C3%A4ffele Im Zuge der Bauarbeiten für die Neugestaltung der Turmbergterrassen wurden lediglich die obersten Treppenstufen äußerlich hergerichtet. Auf seiner übrigen Länge hingegen befinden sich die meisten Stufen in einem desolaten Zustand. Ein durchgehendes Treppengeländer fehlt ebenso wie eine Beleuchtung bei Dunkelheit. Moderne Straßen- bzw. Fußwegbeleuchtungen sind gekennzeichnet durch optionale Photovoltaikelemente zur Stromversorgung, eine smarte Lichtsteuerung durch IR- Bewegungsmelder sowie die Möglichkeit zur Videoüberwachung bei abgelegenen und wenig frequentierten Streckenabschnitten. Lösungsvorschlag: Unabhängig davon, ob überhaupt und falls j…


</details>

- 0.094416 · t (assistant) · 51233: ÖPNV-Ersatzverkehr auf den Turmberg während der Bauphase der Verlängerung der Turmbergbahn · below threshold

- 0.093260 · t (assistant) · 51184: Ersatzverkehr mittels Bus auf den Turmberg · below threshold

- 0.080116 · **new, unreviewed** · 40419: Erneuerung der Turmbergbahn · below threshold

<details><summary>Original candidate sources</summary>


[Paper record](../../../docs/papers/40419.json)
- Änderungs-/Ergänzungsantrag: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00620275.pdf>) · [extracted text](../../../docs/file-contents/620275.txt)
- Stellungnahme Turmbergbahn Änderungsantrag: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00620298.pdf>) · [extracted text](../../../docs/file-contents/620298.txt)

Original content section — Änderungs-/Ergänzungsantrag:
> Die Verwaltung hat bestätigt, dass eine Mittelstation technisch möglich ist. Da die eine Verlängerung der Turmbergbahn bis zur Talsohle des Turmbergs für die Markgrafenstadt eine große Attraktivitätssteigerung bedeutet, sollte nicht nur eine durchgängige Fahrt auf den Turmberg ohne Umsteigen ermöglicht werden, sondern auch gewährleistet sein, den Einwohnern der rund um die jetzige Talstation gelegenen Straßen, darunter auch ältere Bevölkerung, die ÖPNV-Verbindung nach Durlach zu erleichtern. Dies geht nur mit einer Anlage eines Haltepunkts im Bereich der jetzigen Talstation. Der Ortschaftsrat Durlach hat sich mehrheitlich für die Einrichtung einer Mittelstation ausgesprochen. Unterzeichnet von: Parsa Marvi Sibel Uysal Änderungsantrag

Passage sharing title words (context only) — Änderungs-/Ergänzungsantrag:
> Gedruckt auf 100 Prozent Recyclingpapier Erneuerung der Turmbergbahn SPD-Gemeinderatsfraktion Vorlage Nr.: 2020/1208 Gremium Termin TOP ö nö Gemeinderat 20. Oktober 2020 4 Im Rahmen der Erneuerung und Verlängerung der Turmbergbahn wird im Bereich der jetzigen Talstation ein Haltepunkt der Turmbergbahn als sogenannte Mittelstation eingerichtet, die als Bedarfshaltestelle ausgestaltet werden kann. Begründung: Die Verwaltung hat bestätigt, dass eine Mittelstation technisch möglich ist. Da die eine Verlängerung der Turmbergbahn bis zur Talsohle des Turmbergs für die Markgrafenstadt eine große Attraktivitätssteigerung bedeutet, sollte nicht nur eine durchgängige Fahrt auf den Turmberg ohne Umstei…


</details>

### 51446: Umsetzungsstand: First-Responder-App der Region der Lebensretter

<details><summary>Original query sources</summary>


[Paper record](../../../docs/papers/51446.json)
- Anfrage: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00664169.pdf>) · [extracted text](../../../docs/file-contents/664169.txt)
- Stellungnahme Anfrage: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00664283.pdf>) · [extracted text](../../../docs/file-contents/664283.txt)

Original content section — Anfrage:
> Gedruckt auf 100 Prozent Recyclingpapier Vorlage Nr.: 2025/0030 Eingang: 14.01.2025 Umsetzungsstand: First-Responder-App der Region der Lebensretter Anfrage: CDU 1. Aus welchen Gründen wurde die First-Responder-App der Region der Lebensretter noch nicht implementiert? 2. Wie lautet der aktuelle Umsetzungsstand? Wann wird die App in Karlsruhe verfügbar sein? 3. Welche Ergebnisse hinsichtlich einer gemeinsamen Finanzierung haben die Gespräche mit dem Landkreis Karlsruhe gebracht? 4. Welche Auswirkungen hat das baden-württembergische Rettungsdienstgesetz auf die Finanzierung der App in Karlsruhe? Sachverhalt / Begründung Am 14. Mai 2024 hat sich der Gemeinderat – bei einer einzigen Gegenstimme – für die Implementierung der First-Responder-App der „Region der Lebensretter“ ausgesprochen (siehe Vorlage-Nr. 2024/0031). Die guten Argumente zur Einführung der Lebensretter-App für medizinisches Fachpersonal sind unbestritten und sowohl im Ausschuss für öffentliche Einrichtungen am 16. April 202…


</details>

- 0.232753 · s (assistant) · 48782: Karlsruhe als Mitglied der "Region der Lebensretter"

- 0.087839 · **new, unreviewed** · 46504: Aktuelle Information zur Integrierten Leitstelle Karlsruhe · below threshold

<details><summary>Original candidate sources</summary>


[Paper record](../../../docs/papers/46504.json)
- Vorlage Aktuelle Information zur ILS Karlsruhe: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00636139.pdf>) · [extracted text](../../../docs/file-contents/636139.txt)
- Präsentation für Infovorlage\_Aktuelle Information zur ILS Karlsruhe: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00636312.pdf>) · [extracted text](../../../docs/file-contents/636312.txt)

Original content section — Vorlage Aktuelle Information zur ILS Karlsruhe:
> Aufgaben und Trägerschaft der Integrierten Leitstelle (ILS) Karlsruhe Als Leitstelle für Rettungsdienst, Feuerwehr und Katastrophenschutz werden in der ILS alle Notrufe der Nummer 112 aus dem Stadt- und Landkreis Karlsruhe bearbeitet. In Abhängigkeit des Notfallereignisses werden die erforderlichen Einheiten des Rettungsdienstes oder der Feuerwehr an die Einsatzstelle entsandt. Des Weiteren werden Anrufe zur Koordination des qualifizierten Krankentransports wie auch des Kassenärztlichen Notdienstes, hier in den Zeiten der Nicht-Verfügbarkeit der niedergelassenen Ärzte, angenommen und bearbeitet. Dringende Vermittlungen zwischen den Gefahrenabwehrbehörden sowie die Führungsunterstützung für die im Einsatz befindlichen Einheiten sind weitere zentrale Aufgaben. In 2017 wurden die damalige Rettungsleitstelle in Bruchsal und die Feuerwehrleitstelle in Karlsruhe aufgrund einer Rechtsänderung in der ILS am Standort der neuen Karlsruher Hauptfeuerwache zusammengeführt. Dazu wurde eine Trägersc…

Passage sharing title words (context only) — Präsentation für Infovorlage\_Aktuelle Information zur ILS Karlsruhe:
> Bewohner im Stadt- (ca. 320.000) und Landkreis (ca. 450.000) Gesamtfläche von 1258 km² Koordination von: Feuerwehr Rettungsdienst Wasserrettungsdienst (DLRG) Helfer vor Ort (First Responder) Einheiten des Katastrophenschutzes, z.B. Einsatzeinheiten des Sanitätsdienstes, Bergwacht, ... 2 Integrierte Leitstelle Karlsruhe (ILS) Historie ILS Karlsruhe 3 Seit März 2017 in Betrieb, zuvor getrennte Leitstellen für FW und RD ca. 70 Mitarbeiter\*innen aus dem Pool aller Träger 7/24 Betrieb tagsüber zu Spitzenzeiten, bis zu 15 Personen gleichzeitig im Betriebsraum im Durchschnitt ca. 500 Einsätze und 1250 Telefonate in 24h Hochskalieren bei Flächen- oder Großeinsatzlagen möglich 4 ILS Karlsruhe -Kenngr…


</details>

- 0.052389 · **new, unreviewed** · 50062: Bericht über den Weiterbildungsverbund Allgemeinmedizin Region Karlsruhe · below threshold

<details><summary>Original candidate sources</summary>


[Paper record](../../../docs/papers/50062.json)
- Informationsvorlage: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00656500.pdf>) · [extracted text](../../../docs/file-contents/656500.txt)
- Präsentation: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00656321.pdf>) · [extracted text](../../../docs/file-contents/656321.txt)
- Anlage: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00656320.pdf>) · [extracted text](../../../docs/file-contents/656320.txt)

Original content section — Informationsvorlage:
> Aktueller Stand der hausärztlichen Versorgung in Karlsruhe Die hausärztliche Versorgungssituation im Stadt- und Landkreis Karlsruhe hat sich in den letzten Jahren aufgrund des demografischen und strukturellen Wandels (Wunsch nach Angestelltenverhältnissen, Teilzeitarbeit etc.) zunehmend verschlechtert. Dies zeigt sich auch in den Entwicklungen des prozentualen Arzt/Einwohner-Verhältnisses der vier Mittelbereiche, in welche die Region Karlsruhe gemäß der Bedarfsplanung der Kassenärztlichen Vereinigung Baden-Württemberg (KVBW) eingeteilt wird 1 (vgl. Anlage: Karte der Region Karlsruhe eingeteilt in die vier Mittelbereiche gemäß Bedarfsplanung). Versorgungsgrade der Mittelbereiche der Region Karlsruhe Mit Stand vom 18. Oktober 2023 gibt es im Mittelbereich Karlsruhe 56 Niederlassungs- bzw. Anstellungsmöglichkeiten in der hausärztlichen Versorgung. Bei der Berechnung der offenen Stellen liegt die regionale Verhältniszahl von 1.696 Patientinnen und Patienten pro Arzt/Ärztin zugrunde. Um ein…

Passage sharing title words (context only) — Informationsvorlage:
> ruckt auf 100 Prozent Recyclingpapier Verantwortlich: Dez. 5 Dienststelle: Umwelt- und Arbeitsschutz Vorlage Nr.: 2024/0192 Bericht über den Weiterbildungsverbund Allgemeinmedizin Region Karlsruhe GremienTerminTOPÖ / NZuständigkeit Ausschuss für Umwelt und Gesundheit22.03.2024ÖKenntnisnahme Information (Kurzfassung) Die hausärztliche Versorgungslage verschlechtert sich in der Region Karlsruhe zusehends. Dies begründet sich vorrangig in den Folgen des demografischen und strukturellen Wandels (Wunsch nach Angestelltenverhältnissen, Teilzeitarbeit etc.). In der Konsequenz einer im Jahr 2022 von der Stadtverwaltung Karlsruhe initiierten Analyse sowie der Kommunalen Gesundheitskonferenz zum Thema…


</details>

### 51623: Haushaltssperre 2025 Stadt Karlsruhe

<details><summary>Original query sources</summary>


[Paper record](../../../docs/papers/51623.json)
- Stellungnahme Antrag Grötzingen: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00665171.pdf>) · [extracted text](../../../docs/file-contents/665171.txt)
- Antrag Grötzingen: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00665172.pdf>) · [extracted text](../../../docs/file-contents/665172.txt)

Original Kurzfassung — Stellungnahme Antrag Grötzingen:
> Die Ortsverwaltung teilt mit, dass die Vorschläge zur Konkretisierung der haushaltswirtschaftlichen Sperre von allen Fachämtern der Stadt Karlsruhe bis zum 28. März 2025 der Kämmerei zu melden sind. Daher kann zum jetzigen Zeitpunkt keine abschließende Aussage darüber getroffen werden, welche Auswirkungen die Haushaltssperre auf laufende und kommende Großprojekte hat. Die betroffenen Gelder für diese Projekte sind nicht im Teilhaushalt der Ortsverwaltung Grötzingen eingeplant, sondern bei den entsprechenden Fachämtern. Laut Schreiben des Oberbürgermeisters vom 5. Februar 2025 wird vorerst auf Maßnahmen im Bereich der Stellenbewirtschaftung verzichtet. Des Weiteren werden im Finanzhaushalt für das Haushaltsjahr 2025 keine Einschränkungen gegenüber der aktuellen Planung vorgenommen. Das Stadtplanungsamt und Amt für Hochbau- und Gebäudewirtschaft haben wegen der Ortskernsanierung sowie der Kindertagesstätte Ringelberghohl Stellung genommen.


</details>

- 0.286703 · s (human) · 51855: Haushaltssicherung Stadt Karlsruhe; haushaltswirtschaftliche Sperre 2025 - Umsetzung

- 0.200633 · t (human) · 39849: Verfügung einer Haushaltssperre

- 0.147426 · t (human) · 54346: Haushaltswirtschaftliche Sperre 2026

### 51633: Baugebiet "Zukunft Nord" - Sachstandsinformation

<details><summary>Original query sources</summary>


[Paper record](../../../docs/papers/51633.json)
- Informationsvorlage: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00665272.pdf>) · [extracted text](../../../docs/file-contents/665272.txt)
- Anlage 1: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00665674.pdf>) · [extracted text](../../../docs/file-contents/665674.txt)
- Anlage 2: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00665680.pdf>) · [extracted text](../../../docs/file-contents/665680.txt)

Original Kurzfassung — Informationsvorlage:
> Die Stadtverwaltung informiert den Planungsausschuss über den aktuellen Sachstand der Erschließungsmaßnahmen, die Beratungen zur Qualitätssicherung sowie den weiteren zeitlichen Ablauf der Hochbaumaßnahmen im Baugebiet "Zukunft Nord". In einem ersten Teilumlegungsplan wurde der nördliche Bereich des Bebauungsplangebietes "Westlich der Erzbergerstraße zwischen New-York-Straße und Lilienthalstraße“ in Karlsruhe-Nordstadt neu geordnet und bebaubare Grundstücke geschaffen. Die Erschließungsarbeiten werden aktuell ausgeführt, sodass die Bebauung von allen Baufeldern nördlich des Quartiersplatzes bis voraussichtlich Mitte 2026 für circa 2.260 Einwohner\*innen in circa 1.000 Wohneinheiten ermöglicht wird. Zur Qualitätssicherung der geplanten Bebauung werden Planungswettbewerbe und Beratungen in der Gestaltungskommission durchgeführt.


</details>

- 0.273885 · s (assistant) · 49791: Benennung von sechs Straßen im Umlegungsgebiet "Zukunft Nord" in der Nordstadt

- 0.273647 · s (assistant) · 47776: Bebauungsplan "Westlich der Erzbergerstraße zwischen New-York-Straße und Lilienthalstraße", Karlsruhe-Nordstadt

- 0.255555 · s (assistant, follow-up review) · 41783: Bebauungsplan "Westlich der Erzbergerstraße zwischen New-York-Straße und Lilienthalstraße", Karlsruhe-Nordstadt: Auslegungsbeschluss

<details><summary>Original candidate sources</summary>


[Paper record](../../../docs/papers/41783.json)
- BPlan Erzbergerstraße Auslegungsbeschluss: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00628187.pdf>) · [extracted text](../../../docs/file-contents/628187.txt)
- Anlage Synopse Erzbergerstraße: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00628163.pdf>) · [extracted text](../../../docs/file-contents/628163.txt)
- Anlage Begründung Erzbergerstraße: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00628164.pdf>) · [extracted text](../../../docs/file-contents/628164.txt)
- Anlage Festsetzungen Erzbergerstraße: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00628165.pdf>) · [extracted text](../../../docs/file-contents/628165.txt)
- Umweltbericht\_Zukunft Nord: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00628166.pdf>) · [extracted text](../../../docs/file-contents/628166.txt)
- Umweltbericht Anlagen\_1-4: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00628167.pdf>) · [extracted text](../../../docs/file-contents/628167.txt)

Original content section — BPlan Erzbergerstraße Auslegungsbeschluss:
> Der Gemeinderat beschließt die Fortführung des Bebauungsplanverfahrens „Westlich der Erzbergerstraße zwischen New-York-Straße und Lilienthalstraße“, Karlsruhe-Nordstadt, mit der Auslegung des Bebauungs- planentwurfs gemäß § 3 Abs. 2 BauGB. Der Auslegung ist grundsätzlich der Bebauungsplanentwurf vom 20. August 2018 in der Fassung vom 8. September 2021 zugrunde zu legen. Änderungen und Ergänzungen, die die Grundzüge der Planung nicht berühren, kann das Bürgermeisteramt noch in den Bebauungsplanentwurf aufnehmen und zu diesem Zweck gegebenenfalls die öffentliche Auslegung des Bebauungsplanentwurfs wiederholen. Finanzielle Auswirkungen der Maßnahme Einzahlungen \| Erträge (Zuschüsse und Ähnliches) Jährliche laufende Belastung (Folgekosten mit kalkulatorischen Kosten abzüglich Folgeerträge und Folgeeinsparungen) ca. 38 Mio. € ca. 19 Mio. € Haushaltsmittel sind dauerhaft im Budget vorhanden ergänzenden Erläuterungen auszuführen: x Umschichtungen innerhalb des Dezernates Der Gemeinderat besch…


</details>

### 51776: Vereinbarung einer Bildungspartnerschaft zwischen der Bau- und Architekturgeschichte am Karlsruher Institut für Technologie (KIT) und dem Stadtarchiv

<details><summary>Original query sources</summary>


[Paper record](../../../docs/papers/51776.json)
- Beschlussvorlage: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00666434.pdf>) · [extracted text](../../../docs/file-contents/666434.txt)
- Anlage: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00666454.pdf>) · [extracted text](../../../docs/file-contents/666454.txt)

Original Kurzfassung — Beschlussvorlage:
> Die bereits seit Jahren bestehende Kooperation zwischen dem Fachgebiet Bau- und Architekturgeschichte (BAG) am KIT und dem Stadtarchiv soll durch den Abschluss einer Vereinbarung über eine Bildungspartnerschaft weiter intensiviert und ausgebaut werden. Der Abschluss der Vereinbarung bekräftigt den beiderseitigen Willen, die gute Zusammenarbeit weiter fortzusetzen und stärkt auch die Position des Stadtarchivs als außeruniversitärer Lernort und Partner für wissenschaftliche Institutionen. Der Gemeinderat beschließt den Abschluss der Bildungspartnerschaft zwischen der Bau- und Architekturgeschichte am KIT und dem Stadtarchiv gemäß Anlage.


</details>

- 0.088876 · **new, unreviewed** · 51288: 200 Jahre Karlsruher Institut für Technologie (KIT), Jahresprogramm · below threshold

<details><summary>Original candidate sources</summary>


[Paper record](../../../docs/papers/51288.json)
- Informationsvorlage: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00663639.pdf>) · [extracted text](../../../docs/file-contents/663639.txt)

Original Kurzfassung — Informationsvorlage:
> 2025 feiert das Karlsruher Institut für Technologie (KIT) 200-jähriges Jubiläum seit der Gründung der Polytechnischen Schule, der späteren Universität Karlsruhe. Das KIT lädt das ganze Jahr über zu einem abwechslungsreichen Programm ein, unter dem Motto „Wir gestalten Zukunft. Forschung \| Lehre \| Transfer“. Stadt Karlsruhe, städtische Gesellschaften und andere Institutionen tragen zu dem Jubiläum mit Veranstaltungen und anderen Formaten bei. Denn das Jubiläum passt genau zur Markenstrategie der Stadt mit den drei Markenkernthemen (Alleinstellungsmerkmalen) „Recht & Demokratie“, „Medienkunst – UNESCO City of Media Arts“ und „Kluge Entwicklungen – Klima für Innovation“. Der Gemeinderat nimmt von der Informationsvorlage zum 200-jährigen Jubiläum des KIT Kenntnis.

Passage sharing title words (context only) — Informationsvorlage:
> Gedruckt auf 100 Prozent Recyclingpapier Vorlage Nr.: 2024/1328 Verantwortlich: Dez. 1 Dienststelle: Stabsstelle Außenbeziehungen und Strategisches Marketing 200 Jahre Karlsruher Institut für Technologie (KIT), Jahresprogramm / Ausstrahlung auf die Marke Karlsruhe Kurzfassung 2025 feiert das Karlsruher Institut für Technologie (KIT) 200-jähriges Jubiläum seit der Gründung der Polytechnischen Schule, der späteren Universität Karlsruhe. Das KIT lädt das ganze Jahr über zu einem abwechslungsreichen Programm ein, unter dem Motto „Wir gestalten Zukunft. Forschung \| Lehre \| Transfer“. Stadt Karlsruhe, städtische Gesellschaften und andere Institutionen tragen zu dem Jubiläum mit Veranstaltungen un…


</details>

- 0.076232 · **new, unreviewed** · 37059: Korridorthema "Zukunft Innenstadt" - IQ-Leitprojekt "Innenstadt von Morgen aus Sicht der Studierenden" - Ergebnisbericht zur Studierendenbefragung · below threshold

<details><summary>Original candidate sources</summary>


[Paper record](../../../docs/papers/37059.json)
- Ergebnisbericht zur Studierendenbefragung: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00608244.pdf>) · [extracted text](../../../docs/file-contents/608244.txt)
- Anlage Ergebnisdokumentation\_StudentInnenstadt: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00608261.pdf>) · [extracted text](../../../docs/file-contents/608261.txt)

Original content section — Ergebnisbericht zur Studierendenbefragung:
> Der Gemeinderat nimmt nach Vorberatung in Wirtschaftsförderungsausschuss und Hauptaus- schuss den Ergebnisbericht zur Kenntnis.

Passage sharing title words (context only) — Anlage Ergebnisdokumentation\_StudentInnenstadt:
> 2018 vom Wissenschaftsbüro der Stadt Karlsruhe in Kooperation mit dem Institut „Entwerfen von Stadt und Landschaft, Fachgebiet Stadtquartiersplanung“ des Karlsruher Instituts für Technologie (KIT) entwickelt. Ziel war es, die Karlsruher Studierenden bei der Ideenfi ndung zu zukünftigen Entwicklungen der Innenstadt einzubeziehen und herauszufi nden, wie sie ihre Stadt wahrnehmen, wo sie sich aufhalten und was sie sich für die Zukunft wünschen. In der ersten Phase wurde anhand einer Online-Umfrage die Zufriedenheit der Studierenden mit der Stadt und dem dazugehörigen Angebot ermittelt. Im nächsten Schritt bot ein interaktives Online-Mapping-Tool Studierenden die Möglichkeit, Quartiere qualita…


</details>

- 0.068365 · **new, unreviewed** · 51663: Untersuchungen zum öffentlichen Nahverkehr in Grötzingen · below threshold

<details><summary>Original candidate sources</summary>


[Paper record](../../../docs/papers/51663.json)
- Antrag Grötzingen: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00665463.pdf>) · [extracted text](../../../docs/file-contents/665463.txt)
- Stellungnahme Antrag Grötzingen: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00665465.pdf>) · [extracted text](../../../docs/file-contents/665465.txt)

Original content section — Antrag Grötzingen:
> Gedruckt auf 100 Prozent Recyclingpapier Vorlage Nr.: 2025/0236 Eingang: 05.03.2025 Untersuchungen zum öffentlichen Nahverkehr in Grötzingen (Antrag der SPD-Ortschaftsratsfraktion) Ortschaftsrat Grötzingen 26.03.2025 4 Ö Kenntnisnahme Die Verbesserung des öffentlichen Nahverkehrs ist von großer Bedeutung für die Lebensqualität unserer Bürgerinnen und Bürger. Eine effiziente und bedarfsgerechte Anbindung an das öffentliche Verkehrsnetz trägt nicht nur zur Reduzierung des Individualverkehrs bei, sondern ermöglicht auch eine nachhaltigere Mobilität in unserem Stadtteil. Der Ortschaftsrat Grötzingen hat mit seinem interfraktionellen Antrag am 28. Februar 2024 die Verwaltung bzw. die VBK beauftragt, eine umfassende Untersuchung der bestehenden Buslinien und möglicher Alternativen durchzuführen. Diese Untersuchung wurde im Rahmen einer Bachelorarbeit beim Karlsruher Institut für Technologie (KIT) – Institut für Verkehrswesen durchgeführt. Die SPD-Fraktion beantragt, dass die seit Herbst letz…


</details>

### 51859: Beigeordnetenwahl Dezernat 4 und Funktion der oder des Ersten Beigeordneten - Stellenausschreibung, Wahlverfahren und Festlegung des Termins für die Beigeordnetenwahl und der gesonderten Wahl der oder des Ersten Beigeordneten

<details><summary>Original query sources</summary>


[Paper record](../../../docs/papers/51859.json)
- Beschlussvorlage\_Verfahren BGO-Wahl Dez 4\_Session: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00666961.pdf>) · [extracted text](../../../docs/file-contents/666961.txt)
- Stellenanzeige\_Beigeordneter Dez4: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00667135.pdf>) · [extracted text](../../../docs/file-contents/667135.txt)

Original Kurzfassung — Beschlussvorlage\_Verfahren BGO-Wahl Dez 4\_Session:
> 1. Die Besetzung der freiwerdenden Beigeordnetenstelle erfolgt entsprechend den Ausführungen in den ergänzenden Erläuterungen. Die Funktion der\*des Ersten Beigeordneten wird in Verbindung mit der Stellenausschreibung der\*des Beigeordneten für das Dezernat 4 ausgeschrieben. 2. Die Beigeordnetenstelle/Stelle der\*des Ersten Beigeordneten wird mit dem Text gemäß Anlage in der StadtZeitung der Stadt Karlsruhe am 06.06.2025 sowie auf der Homepage der Stadt Karlsruhe ausgeschrieben. 3. Die Wahl der\*des Beigeordneten wird in der Gemeinderatssitzung am 21.10.2025 durchgeführt. 4. Die Wahl der\*des Ersten Beigeordneten erfolgt ebenfalls in der Gemeinderatssitzung am 21.10.2025 im Anschluss an die Wahl der Beigeordneten aus allen Beigeordneten.


</details>

### 51916: Vergabe freigestellter Schülerverkehre für Sonderpädagogische Bildungs- und Beratungszentren (SBBZ), einen Schulkindergarten und eine Berufliche Schule in Karlsruhe und Karlsbad ab dem Schuljahr 2025/2026

<details><summary>Original query sources</summary>


[Paper record](../../../docs/papers/51916.json)
- Beschlussvorlage: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00667143.pdf>) · [extracted text](../../../docs/file-contents/667143.txt)

Original content section — Beschlussvorlage:
> Der Gemeinderat nimmt - nach Vorberatung im Haupt- und Finanzausschuss - von den Erläuterungen Kenntnis und stimmt der Vergabe der in den Schuljahren 2025/2026 bis 2028/2029 für die Ludwig Guttmann Schule, die Albschule und den Schulkindergarten an der Alb sowie für die Elisabeth-Selbert- Schule im Schuljahr 2025/2026 durchzuführenden Schülerverkehre an die vorgeschlagenen Beförderungsunternehmen zu. Die Verwaltung wird ermächtigt, den betreffenden Bietern den Zuschlag zu erteilen. Finanzielle Auswirkungen Gesamtkosten: 8.232.844,93 Euro 2.051.238,28 Euro / Schuljahr 2025/2026 2.060.535,55 Euro / Schuljahr 2026/2027 2.060.535,55 Euro / Schuljahr 2027/2028 2.060.535,55 Euro / Schuljahr 2028/2029 CO 2 -Relevanz: Auswirkung auf den Klimaschutz Abstimmung mit städtischen Gesellschaften – 2 – Erläuterungen 1. Ausschreibungsgegenstand Den Schülerinnen und Schülern mit Anspruch auf ein sonderpädagogisches Bildungsangebot ist die Nutzung öffentlicher Verkehrsmittel in der Regel nicht möglich b…


</details>

- 0.770859 · s (assistant) · 41319: Vergabe freigestellter Schülerverkehre für sonderpädagogische Bildungs- und Beratungszentren (SBBZ) und einen Schulkindergarten in Karlsruhe und Karlsbad für die Schuljahre 2021/2022 bis 2022/2023 beziehungsweise 2021/2022 bis 2024/2025

- 0.691625 · t (assistant) · 47002: Vergabe freigestellter Schülerverkehre für Sonderpädagogische Bildungs- und Beratungszentren (SBB) in Karlsruhe und Karlsbad für die Schuljahre 2022/2023 bis 2024/2025

- 0.652105 · t (assistant) · 48768: Vergabe freigestellter Schülerverkehre für Sonderpädagogische Bildungs- und Beratungszentren und Schulkindergärten in Karlsruhe für das Schuljahr 2023/2024

### 52166: Verkehrssituation in der Erbprinzenstraße zwischen Ludwigsplatz und Ecke Herrenstraße/Erbprinzenstraße

<details><summary>Original query sources</summary>


[Paper record](../../../docs/papers/52166.json)
- Anfrage: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00668846.pdf>) · [extracted text](../../../docs/file-contents/668846.txt)
- Stellungnahme Anfrage: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00669107.pdf>) · [extracted text](../../../docs/file-contents/669107.txt)
- Anhang A - Untersuchungsraum Evaluation der Radverkehrsströme Erbprinzenstraße: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00669646.pdf>) · [extracted text](../../../docs/file-contents/669646.txt)
- Anhang B - Mögliche Anpassung Stadtteilroute: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00669647.pdf>) · [extracted text](../../../docs/file-contents/669647.txt)
- Anhang C - Unfallsituation Erbprinzenstraße zw. Ludwigsplatz und KP Herrenstraße: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00669648.pdf>) · [extracted text](../../../docs/file-contents/669648.txt)

Original content section — Anfrage:
> Gedruckt auf 100 Prozent Recyclingpapier Vorlage Nr.: 2025/0689 Eingang: 16.07.2025 Verkehrssituation in der Erbprinzenstraße zwischen Ludwigsplatz und Ecke Herrenstraße/Erbprinzenstraße Anfrage: KAL 1. Wie hoch ist das tägliche Verkehrsaufkommen in der Erbprinzenstraße in dem oben genannten Abschnitt, differenziert nach Verkehrsarten (motorisierter Individualverkehr, Lieferverkehr, Radverkehr, zu Fuß Gehende)? 2. Wie gestaltet sich das Verkehrsaufkommen im oben genannten Abschnitt hinsichtlich der unterschiedlichen Nutzungen als Fuß-, Radweg und Zufahrtsstraße? 3. Wie viele Unfälle wurden in den letzten fünf Jahren in diesem Abschnitt registriert, und wie verteilen sich diese auf die jeweiligen Verkehrsarten (z. B. Kollisionen mit Radfahrenden oder Fußgänger:innen)? Ist der Straßenabschnitt eine Unfallhäufungsstelle? 4. Der Abschnitt ist in Teilen als verkehrsberuhigte Zone mit gemeinsam genutztem verkehrsraum der Verkehrsteilnehmenden gestaltet. a. Wie bewertet die Stadtverwaltung di…


</details>

- 0.181101 · t (assistant) · 21258: Antrag SPD: Erarbeitung eines Gestaltungskonzeptes für Herrenstraße

- 0.134234 · t (assistant) · 47517: Fahrradroute Sophienstraße - Herrenstraße - Erbprinzenstraße vorbereiten und ausweisen

- 0.123860 · t (assistant) · 49181: Satzung zur Änderung der Satzung über Sondernutzungen in den Fußgängerbereichen

### 52252: Ergebnisse der Vorstudie "Circular Economy in Karlsruhe" und Strategieauftrag

<details><summary>Original query sources</summary>


[Paper record](../../../docs/papers/52252.json)
- Informationsvorlage Ergebnisse Vorstudie Circular Economy: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00670043.pdf>) · [extracted text](../../../docs/file-contents/670043.txt)
- Anlage 1 OnePager zur Vorstudie und gemeinsamen Verständnis von Circular Economy in Karlsruhe: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00669379.pdf>) · [extracted text](../../../docs/file-contents/669379.txt)
- Anlage 3 Ergebnisdokumentation zum Visions-Workshop, 13. Mai 2025 (als Teil der Vorstudie): [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00669381.pdf>) · [extracted text](../../../docs/file-contents/669381.txt)
- Anlage 4 Visionsbild zur gesamtstädtischen Leitvision Circular Economy in Karlsruhe: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00669382.pdf>) · [extracted text](../../../docs/file-contents/669382.txt)
- Anlage2\_Bericht Vorstudie Circular Economy Karlsruhe: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00670044.pdf>) · [extracted text](../../../docs/file-contents/670044.txt)

Original Kurzfassung — Informationsvorlage Ergebnisse Vorstudie Circular Economy:
> Circular Economy ist für den Wirtschafts- und Wissenschaftsstandort Karlsruhe zentrales Zukunftsthema für nachhaltige Stadtentwicklung, wirtschaftliche Resilienz, Innovation und Klimaschutz. Mit der Vorstudie „Circular Economy in Karlsruhe“ wurde 2024/25 eine fundierte Grundlage geschaffen, um eine gesamtstädtische Strategie zu entwickeln. Sie zeigt, dass vier Aktionsfelder Transformationspotenziale bieten: zirkuläres Bauen, zirkuläre Wertschöpfung, Lifestyle & Konsum sowie lokale Ernährung. Mit dem Visions-Workshop am 13. Mai 2025 gelang es, über 80 Akteur\*innen und Expert\*innen aus allen Sektoren für eine gemeinsame Leitvision zu gewinnen. Diese Vision bildet nun den Ausgangspunkt für die Strategieentwicklung. Ziel ist es, ab 2026 innerhalb der Stadtverwaltung dezernatsübergreifend wirksame Strukturen, Maßnahmen und Netzwerke zu etablieren.


</details>

- 0.096601 · t (human) · 34542: Share Economy in Karlsruhe - Ressourcen schonen, Gemeinschaft stärken, Wirtschaft fördern! · below threshold

- 0.059083 · s (human) · 40570: Erneuerung der Strategie der Wirtschaftsförderung der Stadt Karlsruhe mit dem Schwerpunkt Klimaneutralität und Kreislaufwirtschaft · below threshold

- 0.049516 · **new, unreviewed** · 39870: Gemeinwohl-Bilanzen für eine nachhaltige, ökologische und soziale Wirtschaft beispielhaft für eine städtische Gesellschaft und ein städtisches Amt erstellen · below threshold

<details><summary>Original candidate sources</summary>


[Paper record](../../../docs/papers/39870.json)
- Antrag: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00617859.pdf>) · [extracted text](../../../docs/file-contents/617859.txt)
- Stellungnahme Gemeinwohl-Bilanzen: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00618280.pdf>) · [extracted text](../../../docs/file-contents/618280.txt)

Original content section — Antrag:
> Der Wiederaufbau der Wirtschaft nach der Corona Krise soll durch einen Umbau des Wirtschaftssys- tems hin zu mehr Nachhaltigkeit, Krisensicherheit und Klimaschutz geprägt sein. Auch die Stadt ist eine wirtschaftliche Akteurin, einerseits durch ihre Gesellschaften und andererseits durch ihre Ver- waltungstätigkeit, z. B. durch Dienstleistungen im Rahmen der Daseinsvorsorge und in der Vergabe von Aufträgen. Die „Gemeinwohl-Bilanz“ stellt ein passendes Werkzeug dar, um aufzuzeigen, in welchem Umfang die Gemeinwohlorientierung besteht, bzw. in welchen Bereichen sie erhöht werden kann. Für eine erste vollständige Bilanzierung ist bei einem Amt oder einer Gesellschaft notwendig, dass in der Füh- rungsebene eine hohe Motivation für die Umsetzung der Gemeinwohlbilanzierung besteht. Mit diesem Antrag wollen die antragstellenden Fraktionen eine werte-orientierte, ethische Wirt- schaftsweise fördern. Zu Punkt 1 Bilanzierungsphase Der erste Schritt, die „Gemeinwohl-Bilanz“ stellt eine Momentaufnah…


</details>

### 52297: Festsetzung des Wirtschaftsplans 2026 des Eigenbetriebs "Fußballstadion im Wildpark"

<details><summary>Original query sources</summary>


[Paper record](../../../docs/papers/52297.json)
- Festsetzung des Wirtschaftsplans 2026 des Eigenbetriebs Fußballstadion im Wildpark: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00669674.pdf>) · [extracted text](../../../docs/file-contents/669674.txt)
- @Wirtschaftsplan 2026: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00670276.pdf>) · [extracted text](../../../docs/file-contents/670276.txt)

Original Kurzfassung — Festsetzung des Wirtschaftsplans 2026 des Eigenbetriebs Fußballstadion im Wildpark:
> Der Gemeinderat beschließt, nach Vorberatung im Betriebsausschuss, den Wirtschaftsplan 2026 (Anlage) einschließlich der mittelfristigen Finanzplanung und dessen Festsetzung wie in der Vorlage dargestellt.


</details>

- 0.845015 · t (assistant) · 50948: Festsetzung des Wirtschaftsplans 2025 des Eigenbetriebs "Fußballstadion im Wildpark"

- 0.661642 · t (assistant) · 49322: Festsetzung des Wirtschaftsplans 2024 des Eigenbetriebs "Fußballstadion im Wildpark"

- 0.578167 · t (assistant) · 47033: Festsetzung des Wirtschaftsplans 2023 des Eigenbetriebs Fußballstadion im Wildpark

### 52813: HHS4\_V250 Ambiente- und Freizeitflächenbeleuchtung erhalten

<details><summary>Original query sources</summary>


[Paper record](../../../docs/papers/52813.json)
- Antrag Grüne\_032: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00672397.pdf>) · [extracted text](../../../docs/file-contents/672397.txt)
- Antrag KAL\_029: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00672398.pdf>) · [extracted text](../../../docs/file-contents/672398.txt)
- Antrag KAL\_030: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00672399.pdf>) · [extracted text](../../../docs/file-contents/672399.txt)
- 6703 Stellungnahme DHH: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00674801.pdf>) · [extracted text](../../../docs/file-contents/674801.txt)

Original content section — Antrag Grüne\_032:
> Die Mittel i.H.v. 3.000 Euro für die Ambiente- und Freizeitflächenbeleuchtung werden weiterhin zur Verfügung gestellt. Sie werden dazu verwendet, um bei Calisthenics-Anlagen wie die in der Nähe des Kühlen Kruges eine Bedarfsbeleuchtung einzurichten. Damit wird der Stadtbevölkerung dort die Möglichkeit zur frühmorgendlichen und abendlichen sportlichen Betätigung an der frischen Luft gegeben. Durch den kostenfreien Zugang ist das für Menschen mit geringen ökonomischen Ressourcen ein niederschwel- liges Angebot, sich zu bewegen und fit zu halten. Das ist präventive Gesundheitspolitik. Unterzeichnet von: Aljoscha Löffler, Jorinda Fahringer und GRÜNE Fraktion


</details>

- 0.185904 · s (assistant, follow-up review) · 52393: Beleuchtung für die Calisthenics-Anlage am "Kühler Krug": Mit wenig Aufwand mehr Sicherheit, Nutzbarkeit und Lebensqualität schaffen

<details><summary>Original candidate sources</summary>


[Paper record](../../../docs/papers/52393.json)
- Anfrage: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00670309.pdf>) · [extracted text](../../../docs/file-contents/670309.txt)
- Stellungnahme Anfrage: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00670442.pdf>) · [extracted text](../../../docs/file-contents/670442.txt)

Original content section — Anfrage:
> Gedruckt auf 100 Prozent Recyclingpapier Vorlage Nr.: 2025/0897 Eingang: 22.09.2025 Beleuchtung für die Calisthenics-Anlage am "Kühler Krug": Mit wenig Aufwand mehr Sicherheit, Nutzbarkeit und Lebensqualität schaffen Anfrage: SPD 1. Wie bewertet die Verwaltung die aktuelle Situation der Calisthenics-Anlage am „Kühler Krug“ in den Abendstunden, insbesondere im Hinblick auf Nutzbarkeit und Sicherheit? 2. Liegen der Verwaltung bereits Rückmeldungen oder Beschwerden von Nutzerinnen und Nutzern zur fehlenden Beleuchtung vor? 3. Wäre es technisch möglich, die bestehende Beleuchtung der angrenzenden Haltestelle so zu ergänzen oder auszurichten, dass auch die Anlage mit ausgeleuchtet wird? 4. Welche Kosten würden für eine einfache, funktionale Grundbeleuchtung entstehen, die ein sicheres Training ermöglicht? 5. Wie beurteilt die Verwaltung die Möglichkeit, eine zeitlich begrenzte Beleuchtung – analog zu den benachbarten Tennisplätzen – bis 22:30 Uhr einzurichten? Begründung/Einordnung: Die Cal…


</details>

- 0.176606 · t (assistant, follow-up review) · 38500: Bedarfsbeleuchtung bei Calisthenics-Anlage in der Südstadt

<details><summary>Original candidate sources</summary>


[Paper record](../../../docs/papers/38500.json)
- Antrag: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00615252.pdf>) · [extracted text](../../../docs/file-contents/615252.txt)
- Stellungnahme TOP Calisthenics-Anlage: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00617346.pdf>) · [extracted text](../../../docs/file-contents/617346.txt)

Original content section — Antrag:
> Die geplante Calisthenics-Anlage soll Kindern, Jugendlichen und Erwachsenen zugänglich sein. Jugendliche und Erwachsene haben oft erst in den Abendstunden Zeit, diese Anlage zu nutzen. Besonders in den Wintermonaten ist es ab 17:00 Uhr oft schon dunkel. Eine bewegungsabhängige Bedarfs-Beleuchtung mit insektenfreundlichen Leuchtmitteln würde eine Nutzung der Geräte auch in der dunkleren Jahreszeit ermöglichen und somit dem Ziel „gesund durch Bewegung“ entgegenkommen. Durch die Freizeitsportler steigt auch die "soziale Kontrolle" wodurch auch das Sicherheitsgefühl verbessert werden kann. Zudem haben die potentiellen Nutzer bei den Beteiligungsveranstaltungen signalisiert, dass sie sich eine abendliche Beleuchtung wünschen, da sonst in der dunklen Jahreszeit eine abendliche Benutzung der Sportanlage nicht möglich sei. Unterzeichnet von: Lüppo Cramer Michael Haug Max Braun Rebecca Ansin


</details>

- 0.143737 · t (assistant, follow-up review) · 48633: Erfahrungsbericht - Beleuchtung der Calisthenics-Anlage in der Südstadt sowie des Bolzplatzes Geroldsäcker beim „Blauen Haus“

<details><summary>Original candidate sources</summary>


[Paper record](../../../docs/papers/48633.json)
- Informationsvorlage: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00647473.pdf>) · [extracted text](../../../docs/file-contents/647473.txt)

Original content section — Informationsvorlage:
> Die öffentlichen Freizeit- und Sportanlagen im Stadtgebiet sind im Normalfall nicht beleuchtet. Das ist gängiger Standard in den deutschen Städten und auch in Karlsruhe. Die erste Ausnahme, die es in Karlsruhe gab, war die Einrichtung einer Bedarfsbeleuchtung im Rahmen des Neubaus der neuen Skate-Anlage im Otto-Dullenkopf-Park. Dort wurde 2015 durch die finanzielle Unterstützung eines Leuchtmittelherstellers die Bedarfsbeleuchtung errichtet. In den Folgejahren wurde seitens der Akteure des Bewegungssportes immer wieder der Wunsch nach Beleuchtung öffentlicher Bolzplätze vorgebracht und auch die Beleuchtung einer Calisthenics-Anlage gefordert. In den beiden Sitzungen des Ausschusses für öffentliche Einrichtungen am 03.März 2020 sowie am 23.09.2021 wurde diese Thematik ausführlich erörtert. Das Festhalten an der bisherigen Praxis, öffentliche Freizeitanlagen und Bolzplätze generell nicht zu beleuchten, wird seitens der Politik mehrheitlich nicht unterstützt. Seitens der Verwaltung wurde…


</details>

### 52903: HHS4\_GR8 - Reduzierung der Bezuschussung von Stadtteilhäusern (Reinigung, Mietkosten, Südwerk und nicht verausgabtes Budget) - SÜDWERK - Rücknahme Kürzung

<details><summary>Original query sources</summary>


[Paper record](../../../docs/papers/52903.json)
- Antrag KAL\_021: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00672633.pdf>) · [extracted text](../../../docs/file-contents/672633.txt)
- 1201 Stellungnahme DHH: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00674792.pdf>) · [extracted text](../../../docs/file-contents/674792.txt)

Original content section — Antrag KAL\_021:
> Das Südwerk ist ein wichtiger Treffpunkt für die Nachbarschaft und zentrale Kultur- und Begegnungsstätte im Stadtteil. Eine Streichung der städtischen Bezuschussung für Reinigung, Mietkosten und andere laufende Aus- gaben wird den Betrieb erheblich gefährden. Die Rücknahme der Kürzungen ist notwendig, um die kontinu- ierliche Nutzung und die vielfältigen Angebote des Südwerks für die lokale Gemeinschaft sicherzustellen. Unterzeichnet von: Lüppo Cramer Sonja Döring Michael Haug


</details>

- 0.458248 · s (assistant) · 52640: HHS4\_GR8 - Reduzierung der Bezuschussung von Stadtteilhäusern (Reinigung, Mietkosten, Südwerk und nicht verausgabtes Budget)

- 0.146960 · n (assistant, follow-up review) · 16830: Antrag KAL: Einrichtung eines Fußwegs vom Parkhaus Mendelssohn-Zentrum zum Bürgerzentrum Südwerk

<details><summary>Original candidate sources</summary>


[Paper record](../../../docs/papers/16830.json)
- Vorlage TOP 25: Antrag KAL: Einrichtung eines Fußwegs vom Parkhaus Mendelssohn-Zentrum zum Bürgerzentrum Südwerk: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00502702.pdf>) · [extracted text](../../../docs/file-contents/502702.txt)
- Vorlage TOP 25: Antrag KAL: Einrichtung eines Fußwegs vom Parkhaus Mendelssohn-Zentrum zum Bürgerzentrum Südwerk: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00502703.pdf>) · [extracted text](../../../docs/file-contents/502703.txt)
- TOP 25: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00012848.pdf>) · [extracted text](../../../docs/file-contents/12848.txt)

Original content section — Vorlage TOP 25: Antrag KAL: Einrichtung eines Fußwegs vom Parkhaus Mendelssohn-Zentrum zum Bürgerzentrum Südwerk:
> KAL-Gemeinderatsfraktion vom 24.01.2006 eingegangen 24.01.2006 21. Sitzung des Gemeinderates am 21.02.2006 TOP 25 Vorlage Nr. 585 Öffentlich Nichtöffentlich verantwortlich Dez. 5 Einrichtung eines Fußwegs vom Parkhaus Mendelssohnzentrum zum Bürgerzentrum Südwerk Stellungnahme des Bürgermeisteramtes - Kurzfassung - Zwischen der Aurelis bzw. der DB S Imm, dem Südwerk und der Stadtverwaltung be- steht grundsätzlich Einvernehmen darüber, dass der Zugang zum Bürgerzentrum über einen provisorischen Fußweg erfolgen sollte, bis die reguläre Wegeverbindung über den Stadtpark West und den nördlichen Teil des Grünzugs zur Südstadt hergestellt ist. Über den Verlauf der provisorischen Wegeverbindung konnte in den Verhandlungen mit der PSD-Bank bisher noch kein Konsens erzielt werden. Die Verhandlungen werden mit dem Ziel fortgesetzt, hier eine Einigung herbeizuführen. Der Gemeinderat wird gebeten, den aktuellen Sachstand zur Kenntnis zu nehmen. Finanzielle Auswirkungen nein ja Gesamtaufwand der Maß…


</details>

- 0.093506 · **new, unreviewed** · 49656: Antrag auf Förderung als Stadtteilhaus "Bürgerzentrum Waldstadt - BZW" · below threshold

<details><summary>Original candidate sources</summary>


[Paper record](../../../docs/papers/49656.json)
- Beschlussvorlage\_Stadtteilhaus\_Waldstadt: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00653142.pdf>) · [extracted text](../../../docs/file-contents/653142.txt)
- Anlage\_Förderantrag\_Waldstadt\_mit\_Anhängen: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00653139.pdf>) · [extracted text](../../../docs/file-contents/653139.txt)

Original Kurzfassung — Beschlussvorlage\_Stadtteilhaus\_Waldstadt:
> Der Gemeinderat nimmt nach Vorberatung im Hauptausschuss das Konzept für ein Stadtteilhaus „Bürgerzentrum Waldstadt - BZW“ zur Kenntnis und beschließt, dem Bürgerverein Waldstadt e. V. ab Januar 2024 einen Zuschuss in Höhe von monatlich 2.452,32 Euro (29.427,84 Euro pro Jahr) entsprechend der Förderrichtlinie Stadtteilhäuser (gültig ab 1. Januar 2024) zu gewähren.

Passage sharing title words (context only) — Beschlussvorlage\_Stadtteilhaus\_Waldstadt:
> Förderfähiger Zuschussbetrag Die räumliche Nutzfläche des BZW beträgt 136,24 Quadratmeter mit zwei Räumen, einer Küche und Sanitäranlagen. Gemäß den Grundsätzen zur Förderung von Stadtteilhäusern in Karlsruhe und den bei der Stadt üblichen pauschalen Obergrenzen für die zweckgebundenen Teilzuschüsse für das Rechnungsjahr 2024 wurde der Zuschussbetrag für Miet- und Betriebsneben- sowie Reinigungskosten in Höhe von 29.427,84 Euro wie folgt berechnet: Zuschuss pro Monat pro Jahr Kaltmiete: 136,24 m² à 12 Euro pro m² 1.634,88 Euro 19.618,56 Euro Betriebsnebenkosten: 136,24 m² à 2,75 Euro pro m² 374,66 Euro 4.495,92 Euro Reinigungskosten: 136,24 m² à 3,25 Euro pro m² 442,78 Euro 5.313,36 Euro Ge…


</details>

### 54339: Grünwinkel: Weiterentwicklung WestBahnHub - Teileinziehung

<details><summary>Original query sources</summary>


[Paper record](../../../docs/papers/54339.json)
- Beschlussvorlage: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00676971.pdf>) · [extracted text](../../../docs/file-contents/676971.txt)

Original Kurzfassung — Beschlussvorlage:
> Der Gemeinderat beschließt die formale Einleitung des Teileinziehungsverfahren für den motorisierten Individualverkehr der südwestlichen Fläche unterhalb der Grünwinkler Brücke zur Belebung des öffentlichen Raums am Westbahnhof und beauftragt die Verwaltung, die hierfür erforderlichen Verfahrensschritte durchzuführen.


</details>

- 0.093788 · t (assistant) · 32955: Sanierung Grünwinkler Brücke · below threshold

- 0.079075 · t (assistant) · 41106: Bebauungsplan "Westlich der Hardeckstraße", Karlsruhe-Günwinkel · below threshold

- 0.064524 · **new, unreviewed** · 48592: Teileinziehung Passagehof zur Nutzung als Fußgängerbereich · below threshold

<details><summary>Original candidate sources</summary>


[Paper record](../../../docs/papers/48592.json)
- Beschlussvorlage: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00648651.pdf>) · [extracted text](../../../docs/file-contents/648651.txt)
- Plan Teileinziehung Passagehof Fußgängerbereich: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00648377.pdf>) · [extracted text](../../../docs/file-contents/648377.txt)

Original content section — Beschlussvorlage:
> 1. Der Gemeinderat beschließt nach Vorberatung im Hauptausschuss die (Teil-)Einziehung der in Anlage 1 dargestellten Teilfläche des Passagehofes und Umwidmung der Fläche als beschränkt öffentlicher Weg zur Nutzung als Fußgängerbereich). 2. Der Gemeinderat erklärt sein Einvernehmen mit der Ausweisung des Passagehofs als Fußgängerzone gemäß Zeichen 242.1 Straßenverkehrsordnung (StVO) mit Zusatzzeichen 1020– 1030 „Berechtigte frei“ sowie Zusatzzeichen 1026-35 „Lieferverkehr frei“ und 1042-31 „werktags 8 bis 11 h“ Finanzielle Auswirkungen CO 2 -Relevanz: Auswirkung auf den Klimaschutz Anhörung Ortschaftsrat (§ 70 Abs. 1 GemO) durchgeführt am Abstimmung mit städtischen Gesellschaften – 2 – Ergänzende Erläuterungen 1) Ablauf des Verfahrens bisher Der Gemeinderat hat nach Vorberatung im Planungsausschuss am 9. Februar 2023 in seiner Sitzung am 28. Februar 2023 unter TOP 14 gemäß Vorlage Nr. 2022/2434 den Beschluss gefasst, die Verwaltung zu beauftragen, die formalen Voraussetzungen für die da…

Passage sharing title words (context only) — Beschlussvorlage:
> Beschlussvorlage Gedruckt auf 100 Prozent Recyclingpapier Vorlage Nr.: 2023/0518 Verantwortlich: Dez. 6 Dienststelle: TBA Teileinziehung Passagehof zur Nutzung als Fußgängerbereich Beratungsfolge dieser Vorlage Gremium Termin TOP ö nö Ergebnis Hauptausschuss 11.07.2023 22 x Gemeinderat 18.07.2023 23 x Beschlussantrag 1. Der Gemeinderat beschließt nach Vorberatung im Hauptausschuss die (Teil-)Einziehung der in Anlage 1 dargestellten Teilfläche des Passagehofes und Umwidmung der Fläche als beschränkt öffentlicher Weg zur Nutzung als Fußgängerbereich). 2. Der Gemeinderat erklärt sein Einvernehmen mit der Ausweisung des Passagehofs als Fußgängerzone gemäß Zeichen 242.1 Straßenverkehrsordnung (St…


</details>

### 54495: Sachstand Circular Economy Karlsruhe: Strategieentwicklung und weitere Vorgehensweise 2026/2027

<details><summary>Original query sources</summary>


[Paper record](../../../docs/papers/54495.json)
- Informationsvorlage Circular Economy: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00678362.pdf>) · [extracted text](../../../docs/file-contents/678362.txt)
- Präsentation Sachstand Circular Economy Karlsruhe: Strategieentwicklung und weitere Vorgehensweise 2026/2027: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00678997.pdf>) · [extracted text](../../../docs/file-contents/678997.txt)
- Anlage1 CircularKarlsruhe\_Leitvision: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00678341.pdf>) · [extracted text](../../../docs/file-contents/678341.txt)

Original Kurzfassung — Informationsvorlage Circular Economy:
> Circular Economy ist ein zentrales Zukunftsthema für den Wirtschafts- und Wissenschaftsstandort Karlsruhe und trägt wesentlich zur Stärkung von Resilienz, Innovation und Klimaschutz bei. Mit der Vorstudie „Circular Economy in Karlsruhe“ (2024/2025) sowie dem darauf aufbauenden Visionsprozess wurde eine fundierte fachliche Grundlage geschaffen. Die gesamtstädtische Leitvision ist abgestimmt und dient als verbindlicher Orientierungsrahmen für die weitere Strategieentwicklung. Im Zeitraum 2026 bis 2027 soll eine gesamtstädtische Circular-Economy-Strategie mit breiter Akteursbeteiligung erarbeitet werden. Ziel ist es, die Ergebnisse bis 2027 zusammenzuführen und diese in die städtischen Gremien einzubringen.


</details>

- 0.100980 · t (assistant) · 34542: Share Economy in Karlsruhe - Ressourcen schonen, Gemeinschaft stärken, Wirtschaft fördern!

- 0.072877 · **new, unreviewed** · 46609: Strategie 2030 der Wirtschaftsförderung Karlsruhe · below threshold

<details><summary>Original candidate sources</summary>


[Paper record](../../../docs/papers/46609.json)
- Beschlussvorlage: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00637139.pdf>) · [extracted text](../../../docs/file-contents/637139.txt)
- Fortschreibung: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00637140.pdf>) · [extracted text](../../../docs/file-contents/637140.txt)

Original content section — Beschlussvorlage:
> Der Gemeinderat beschließt nach Vorberatung im Ausschuss für Wirtschaftsförderung vom 30. März 2022 die Strategie 2030 der Wirtschaftsförderung Karlsruhe und beauftragt die Wirtschaftsförderung mit der Umsetzung. Finanzielle Auswirkungen CO 2 -Relevanz: Auswirkung auf den Klimaschutz Kein konkretes IQ-Leitprojekt Anhörung Ortschaftsrat (§ 70 Abs. 1 GemO) durchgeführt am Abstimmung mit städtischen Gesellschaften – 2 – Ergänzende Erläuterungen Auf Grundlage des Evaluationsberichts 2020, der im Ausschuss für Wirtschaftsförderung am 24. September 2020 behandelt wurde, ist als weiteres Vorgehen am 6. November 2020 die Fortschreibung der Strategie der Wirtschaftsförderung Karlsruhe auf Basis der Strategie aus dem Jahr 2011 beschlossen worden. Aus dem Evaluationsbericht 2020 geht hervor, dass die Wirtschaftsförderung Karlsruhe in den Teilstrategien und Kompetenzfeldern nachweislich die richtigen Schwerpunkte hat setzen und erfüllen können. Strategische Fortschreibung Strategische Grundlagen Z…

Passage sharing title words (context only) — Fortschreibung:
> e interne Diskussionen genutzt. Im Frühjahr/ Sommer 2021 konnte mit der Unternehmens- und Betriebsumfrage sowie dem Beteiligungsprozess fortgesetzt werden, deren Ergebnisse in die Strategieentwicklung eingeflossen sind. Zur Diskussion und Validierung der Strategie 2030 der Wirtschaftsförderung Karlsruhe wurde im Rahmen einer Sondersitzung des Ausschusses für Wirtschaftsförderung am 21. Januar 2022 durchgeführt, um weitere Impulse, Anregungen und Kommentare abschließend in die Fortschreibung aufzunehmen. Abbildung 1: Vorgehensmodell zur Umsetzung der Fortschreibung Strategie 2030 Strategiekonzept 2011 Evaluation 2020 auf Basis des Strategiekonzepts 2011 Foresight und Trendanalyse 2020 & inter…


</details>

- 0.059702 · t (assistant) · 40570: Erneuerung der Strategie der Wirtschaftsförderung der Stadt Karlsruhe mit dem Schwerpunkt Klimaneutralität und Kreislaufwirtschaft · below threshold

### 54797: Verschlankung der ortschaftsrätlichen Gremien als Beitrag zur Haushaltsstabilisierung

<details><summary>Original query sources</summary>


[Paper record](../../../docs/papers/54797.json)
- Beschlussvorlage Grötzingen: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00680087.pdf>) · [extracted text](../../../docs/file-contents/680087.txt)

Original Kurzfassung — Beschlussvorlage Grötzingen:
> Die Stadt Karlsruhe befindet sich in der 4. Phase der Haushaltsstabilisierung. In diesem Zusammenhang müssen konsequente und strukturelle Maßnahmen zur Einsparung ergriffen werden. Vor diesem


</details>

- 0.075131 · **new, unreviewed** · 51717: Nutzung von Künstlicher Intelligenz (KI) zur Optimierung von Prozessen in der Stadtverwaltung · below threshold

<details><summary>Original candidate sources</summary>


[Paper record](../../../docs/papers/51717.json)
- Anfrage: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00665830.pdf>) · [extracted text](../../../docs/file-contents/665830.txt)
- Stellungnahme zur Anfrage: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00665939.pdf>) · [extracted text](../../../docs/file-contents/665939.txt)

Original content section — Anfrage:
> Gedruckt auf 100 Prozent Recyclingpapier Vorlage Nr.: 2025/0288 Eingang: 21.03.2025 Nutzung von Künstlicher Intelligenz (KI) zur Optimierung von Prozessen in der Stadtverwaltung Anfrage: FÜR 1. Welche Möglichkeiten sieht die Stadtverwaltung Karlsruhe, KI zur Verschlankung und Optimierung von Verwaltungsprozessen einzusetzen? 2. Wie geht die Stadtverwaltung mit dem bestehenden Personalmangel um, und wird der Einsatz von KI als Lösungsmöglichkeit in Betracht gezogen? 3. Gibt es bereits Überlegungen oder Projekte, in denen KI innerhalb der Stadtverwaltung Karlsruhe getestet oder eingesetzt wird? 4. In welchen Bereichen sieht die Verwaltung das größte Potenzial für den Einsatz von KI, und wo werden klare Grenzen gezogen? 5. Welche rechtlichen Bedenken sieht die Stadtverwaltung beim Einsatz von KI in sensiblen Verwaltungsprozessen? Begründung: Angesichts des zunehmenden Fachkräftemangels und unbesetzter Stellen in der Stadtverwaltung Karlsruhe wäre es von Interesse, inwiefern Künstliche Int…


</details>

- 0.069994 · **new, unreviewed** · 52831: Aussetzung des Empfangs des Oberbürgermeisters zum Tag der Arbeit · below threshold

<details><summary>Original candidate sources</summary>


[Paper record](../../../docs/papers/52831.json)
- Antrag FDP\_FW\_008: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00672445.pdf>) · [extracted text](../../../docs/file-contents/672445.txt)
- 1007 Stellungnahme DHH: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00674868.pdf>) · [extracted text](../../../docs/file-contents/674868.txt)

Original content section — Antrag FDP\_FW\_008:
> Aufgrund der städtischen Haushaltslage wird die Aussetzung des jährlich stattfindenden Empfangs des Ober- bürgermeisters zum Tag der Arbeit bis auf Weiteres beantragt. Die erst vor einigen Jahren eingeführte Veran- staltung gehört nicht zu den öffentlichen Aufgaben der Stadt Karlsruhe. Auch in diesem repräsentativen Be- reich sollten relevante Mittel eingespart werden, wenn diese nicht der breiten Stadtgesellschaft dienen. Unterzeichnet von: Dr. Stefan Noé, Thomas H. Hock, Annette Böringer, Petra Lorenz

Passage sharing title words (context only) — 1007 Stellungnahme DHH:
> beitswelt beleuchtet, beispielsweise durch Keynote-Speaker oder Diskussionsrunden, die den Teilnehmenden neue Denkanstöße geben. Darüber hinaus leistet der Empfang einen wichtigen Beitrag zur Pflege und Festigung der Beziehungen zu Schlüsselakteuren der Stadtgesellschaft. Die Verwaltung empfiehlt, den Antrag abzulehnen.…


</details>

- 0.066023 · **new, unreviewed** · 50680: Festlegung der Größe des beratenden Allgemeinen Ausschusses des Ortschafsrates Wolfartsweier · below threshold

<details><summary>Original candidate sources</summary>


[Paper record](../../../docs/papers/50680.json)
- Beschlussvorlage Wolfartsweier: [PDF](<https://web2.karlsruhe.de/ris/oparl/bodies/0001/downloadfiles/a/00659482.pdf>) · [extracted text](../../../docs/file-contents/659482.txt)

Original Kurzfassung — Beschlussvorlage Wolfartsweier:
> Der Ortschaftsrat Wolfartsweier kann gem. § 32 Abs. 1 der Geschäftsordnung des Ortschaftsrates Wolfartsweier beratende Ausschüsse bilden. Die Zahl der Ausschussmitglieder wird durch einen gesonderten Beschluss des Ortschaftsrates festgelegt.


</details>
