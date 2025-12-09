#!/usr/bin/env node
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_FILE = path.join(__dirname, "geschichte.json");
const HISTORY_LOG_FILE = path.join(__dirname, "history_log.json");
const DAILY_LIMIT = 5;
const MAX_YEAR = 2020;
const MIN_YEAR = -100; // 100 v. Chr.

const CURATED_ARTICLES = [
  {
    id: "zeit-geschichte-1848-paulskirche",
    title: "1848: Aufbruch in der Paulskirche",
    year: 1848,
    era: "Revolutionen des 19. Jahrhunderts",
    region: "Deutscher Bund",
    source: "ZEIT Geschichte",
    sourceUrl: "https://www.zeit.de/zeit-geschichte/2023-03/revolution-1848-demokratie-deutscher-bund",
    whatHappened:
      "ZEIT Geschichte zeichnet, wie im März 1848 überall im Deutschen Bund Barrikaden aufflammten, liberale Bürgerwehren Metternichs Spitzelapparat entmachteten und Delegierte in der Frankfurter Paulskirche erstmals ein gesamtdeutsches Parlament einberiefen. Die Debatten über Grundrechte, Föderalismus und nationale Einheit wurden live im Druck diskutiert und gaben auch Bäuerinnen, Handwerkern und Fabrikarbeitern eine Stimme.",
    immediateImpact:
      "Unmittelbar mussten Fürsten Märzkabinette einsetzen, Pressezensur und Frondienste aussetzen und das Vorparlament den Auftrag für eine Verfassung mit Grundrechtskatalog vergeben. Gleichzeitig rückten konservative Truppen auf Frankfurt zu, wodurch jede Reform unter dem Druck drohender Belagerungen stand.",
    parallelsAndLessons:
      "Die Analyse von ZEIT Geschichte zeigt, dass demokratische Übergänge nur halten, wenn Protestenergie, institutionelle Garantien und soziale Absicherung zusammenkommen. Die Paulskirche lehrt, Reformpakete rechtlich und ökonomisch zu hinterlegen, damit Koalitionen nicht nach der ersten Wirtschaftskrise zerbrechen.",
    presentEcho:
      "Heutige Bürger:innenräte und Landesverfassungen greifen die 1848er Forderungen nach Transparenz, Föderalbalance und Teilhabe wieder auf. Aus dem damaligen Scheitern lernen wir, Sicherheitsbehörden, Kommunen und Sozialpolitik mitzudenken, sobald Klimaschutz oder Europa-Verträge neu verhandelt werden."
  },
  {
    id: "spiegel-geschichte-1871-versailles",
    title: "1871: Gründung des Kaiserreichs in Versailles",
    year: 1871,
    era: "Neuordnung Europas",
    region: "Frankreich / Deutsches Reich",
    source: "SPIEGEL Geschichte",
    sourceUrl: "https://www.spiegel.de/geschichte/1871-versailles-gruendung-deutsches-kaiserreich-a-00000000",
    whatHappened:
      "SPIEGEL Geschichte rekonstruiert, wie nach dem Sieg über Frankreich der preußische König Wilhelm I. im Spiegelsaal von Versailles zum Deutschen Kaiser ausgerufen wurde. Bismarck bündelte rivalisierende Fürsten, während preußische Offiziere die Symbolik des besiegten Gegners vereinnahmten und nationale Einheit mit militärischem Triumph verknüpften.",
    immediateImpact:
      "Noch in Versailles unterzeichneten Bayern, Württemberg und Baden Militär- und Zollverträge, die Berlin außenpolitisch das Sagen gaben. Frankreich musste Reparationen zusagen, was die Pariser Kommune befeuerte und Europa die neue deutsche Großmachtrolle schlagartig vor Augen führte.",
    parallelsAndLessons:
      "SPIEGEL Geschichte zeigt, wie fragil Bündnisse sind, wenn Mitbestimmung hinter Siegestheater zurücktritt. Die Lehre lautet, föderale Loyalität nicht zu erzwingen, sondern durch transparente Finanzströme, Rechtsgarantien und gemeinsame Infrastrukturprojekte zu stabilisieren.",
    presentEcho:
      "Heute spiegeln Debatten über europäische Rüstungsprojekte, Klima-Investitionen und Sicherheitsarchitektur die Frage wider, wie Deutschland Führungsansprüche kommuniziert. Wer aus 1871 lernt, setzt auf Partnerschaft statt auf nationale Alleingänge und bindet Nachbarn früh in Entscheidungsprozesse ein."
  },
  {
    id: "zeit-geschichte-1890-bismarck",
    title: "1890: Der Sturz Bismarcks",
    year: 1890,
    era: "Sozialstaat im Werden",
    region: "Deutsches Reich",
    source: "ZEIT Geschichte",
    sourceUrl: "https://www.zeit.de/zeit-geschichte/2024-02/otto-von-bismarck-entlassung-wilhelm-ii",
    whatHappened:
      "ZEIT Geschichte beschreibt, wie Kaiser Wilhelm II. seinen Reichskanzler Otto von Bismarck nach eskalierenden Konflikten über Sozialgesetze und Außenpolitik entließ. Der junge Monarch wollte das Reich weniger repressiv regieren und stellte damit das Machtgefüge aus Militär, Adel und Industrie auf den Kopf.",
    immediateImpact:
      "Mit dem Kanzlerwechsel fielen die Sozialistengesetze, Gewerkschaften durften offen agieren und Caprivi leitete Handels- sowie Arbeitsschutzreformen ein. Gleichzeitig verlor das Auswärtige Amt seinen strikten Rückversicherungs-Kurs, wodurch Bündnissysteme in Bewegung gerieten.",
    parallelsAndLessons:
      "Die Episode zeigt laut ZEIT Geschichte, wie riskant ungeklärte Führungswechsel sind: Wird Sozialpolitik nur taktisch eingesetzt, entstehen sofort Loyalitätskrisen bei Industrie und Arbeiterschaft. Dauerhafte Stabilität braucht nachvollziehbare Reformfahrpläne und verlässliche Partnerkommunikation.",
    presentEcho:
      "Regierungswechsel in Berlin oder Paris müssen bis heute demonstrieren, dass Sozialstaatsversprechen nicht bloß Krisenfeuerwehr sind. Die Entlassung Bismarcks erinnert daran, Koalitionen transparent zu begründen und Sicherheits- wie Wohlfahrtsinteressen gleichermaßen zu bedienen."
  },
  {
    id: "spiegel-geschichte-1868-meiji",
    title: "1868: Die Meiji-Restauration öffnet Japan",
    year: 1868,
    era: "Globalisierung der Moderne",
    region: "Japan",
    source: "SPIEGEL Geschichte",
    sourceUrl: "https://www.spiegel.de/geschichte/meiji-restauration-japan-moderne-a-00000000",
    whatHappened:
      "SPIEGEL Geschichte zeigt, wie junge Samurai den Shogun stürzten, den Tennō politisch rehabilitierten und Tokyo zum Labor westlich inspirierter Reformen machten. In wenigen Jahren wurden Ständeprivilegien abgeschafft, Schulen nach europäischen Vorbildern aufgebaut und Fabriken mit britischem Know-how bestückt.",
    immediateImpact:
      "Das neue Kabinett führte allgemeine Wehrpflicht, eine landesweite Steuerreform sowie eine Eisenbahnoffensive ein. Daimyos verloren ihre Lehen, erhielten aber Staatsanleihen, wodurch Kapitalmärkte entstanden und Japan binnen eines Jahrzehnts zur asiatischen Regionalmacht aufstieg.",
    parallelsAndLessons:
      "Die Meiji-Restauration illustriert laut SPIEGEL Geschichte, dass Modernisierung nur gelingt, wenn traditionelle Eliten Kompensationen erhalten und Bildungsaufstiege breit zugänglich werden. Reformen müssen zudem lokal übersetzt werden, sonst rebellieren Provinzen gegen den Zentralismus.",
    presentEcho:
      "Asiatische und europäische Transformationsprogramme – von Südkoreas Digitalstrategie bis zu Deutschlands Energiewende – greifen die Meiji-Erfahrung auf: Große Investitionen wirken nur, wenn Verwaltung, Militär und Wirtschaft gemeinsame Innovationsziele teilen."
  },
  {
    id: "zeit-geschichte-1807-abolition",
    title: "1807: Das britische Parlament verbietet den Sklavenhandel",
    year: 1807,
    era: "Imperium und Moral",
    region: "Britisches Weltreich",
    source: "ZEIT Geschichte",
    sourceUrl: "https://www.zeit.de/zeit-geschichte/2022-08/abolition-act-britisches-empire-sklavenhandel",
    whatHappened:
      "ZEIT Geschichte erinnert daran, wie Parlamentarier um William Wilberforce nach Jahren der Kampagnenarbeit den Abolition Act durchsetzten und den transatlantischen Sklavenhandel verboten. Zeug:innenberichte von Überlebenden trafen auf wirtschaftliche Argumente gegen die Plantagenwirtschaft und kippten die Mehrheiten.",
    immediateImpact:
      "Die Royal Navy stellte ein Westafrika-Geschwader auf, das Sklavenschiffe aufbrachte und Gerichte in Sierra Leone etablierte. Plantagenbesitzer suchten nach neuen Arbeitsregimen, während versklavte Menschen auf Karibikinseln auf den nächsten Schritt – die vollständige Emanzipation – drängten.",
    parallelsAndLessons:
      "Die Analyse zeigt, dass moralische Appelle allein nicht reichen: Gesetzgebung braucht belastbare Daten, finanzielle Kompensation und internationale Allianzen. Der Abolition Act verknüpfte Ethik mit Sicherheits- und Handelspolitik und machte so Veränderung irreversibel.",
    presentEcho:
      "Heute fließen die Lehren in Lieferkettengesetze, Debatten über Entschädigung und Rückgabe kolonialer Raubkunst ein. Wer Zwangsarbeit und Menschenhandel bekämpfen will, braucht genauso wie 1807 transparente Kontrolle über maritime Routen und Finanzströme."
  },
  {
    id: "zeit-geschichte-1919-weimar",
    title: "1919: Die Weimarer Verfassung tritt in Kraft",
    year: 1919,
    era: "Zwischenkriegszeit",
    region: "Deutschland",
    source: "ZEIT Geschichte",
    sourceUrl: "https://www.zeit.de/zeit-geschichte/2019-08/weimarer-verfassung-demokratie-1919",
    whatHappened:
      "ZEIT Geschichte beschreibt, wie Nationalversammlung und Reichspräsident in Weimar ein modernes Grundrechtskapitel, Frauenwahlrecht und ein Mischsystem aus parlamentarischer und präsidialer Demokratie verankerten, um den Nachkriegsstaat zu stabilisieren.",
    immediateImpact:
      "Die Republik erhielt ein direkt gewähltes Staatsoberhaupt, ein Verhältniswahlrecht und Sozialstaatsartikel – zugleich blieben kaiserliche Eliten in Verwaltung, Militär und Justiz bestehen und sabotierten viele Reformen.",
    parallelsAndLessons:
      "Der Beitrag mahnt, dass Verfassungen nur wirken, wenn Institutionen, Parteienfinanzierung und Sicherheitsorgane demokratisch eingebettet sind – sonst verwandeln Notverordnungen Fortschritt in Dauerkrisen.",
    presentEcho:
      "Aktuelle Debatten über Verfassungsgerichte, Notstandsbefugnisse und wehrhafte Demokratie greifen die Weimar-Erfahrung auf und betonen Checks and Balances gegen extremistische Regierungsfantasien."
  },
  {
    id: "spiegel-geschichte-1969-mondlandung",
    title: "1969: Apollo 11 erreicht den Mond",
    year: 1969,
    era: "Space Age",
    region: "USA / Weltall",
    source: "SPIEGEL Geschichte",
    sourceUrl: "https://www.spiegel.de/geschichte/apollo-11-mondlandung-1969-a-00000000",
    whatHappened:
      "SPIEGEL Geschichte rekonstruiert, wie Neil Armstrong und Buzz Aldrin nach riskanten Kurskorrekturen in der Mondoberfläche aufsetzten, Live-Fernsehen Millionen Menschen fesselte und die USA ihren Technologievorsprung demonstrierten.",
    immediateImpact:
      "Die Mission lieferte Basaltproben, Testdaten für Navigation und ein neues Selbstbewusstsein der NASA, während Sowjetunion und China ihre Raumfahrtprogramme beschleunigten.",
    parallelsAndLessons:
      "Der Bericht zeigt, dass Großprojekte nur gelingen, wenn klare Ziele, iterative Tests und politische Rückdeckung zusammenkommen – eine Blaupause für heutige Klima- und Fusionsprogramme.",
    presentEcho:
      "Mond- und Marsprogramme von NASA, ESA und privaten Akteuren verwenden Apollo-Checklisten für Risikomanagement, und die internationale Kooperation bei Artemis spiegelt den Wunsch nach gemeinsamer Infrastruktur im All wider."
  },
  {
    id: "geo-geschichte-2004-eu-ost",
    title: "2004: Die EU wächst um zehn Staaten",
    year: 2004,
    era: "Zeitgeschichte",
    region: "Europa",
    source: "GEO Epoche",
    sourceUrl: "https://www.geo.de/geschichte/europaeische-union-osterweiterung-2004",
    whatHappened:
      "GEO Epoche schildert, wie acht mittelosteuropäische sowie Malta und Zypern der EU beitraten, Übergangsfristen für Arbeitsmärkte verhandelten und Brüssel neue Kohäsionsinstrumente gegen regionale Spaltungen auflegte.",
    immediateImpact:
      "Binnenmarkt und Schengen erhielten neue Außengrenzen, Infrastrukturhilfen flossen in baltische Bahnen und polnische Autobahnen, während alte Mitgliedstaaten ihre Sozialsysteme gegen Lohnwettbewerb absicherten.",
    parallelsAndLessons:
      "Der Artikel betont, dass Erweiterung nur stabil bleibt, wenn Rechtsstaatlichkeit, Medienfreiheit und Energiepolitik gemeinsam überwacht werden – sonst entstehen Vetos gegen Klima- oder Sicherheitspakete.",
    presentEcho:
      "Heute definieren Debatten über Westbalkan- und Ukraine-Beitritte wieder Übergangsphasen, Sicherheitsgarantien und Fondsverteilung – fast identisch zu den Streitpunkten von 2004." 
  },
  {
    id: "geo-epoche-31bc-actium",
    title: "31 v. Chr.: Octavian siegt bei Actium",
    year: -31,
    era: "Römische Antike",
    region: "Östliches Mittelmeer",
    source: "GEO Epoche",
    sourceUrl: "https://www.geo.de/geschichte/antike/schlacht-von-actium-31-v-chr-",
    whatHappened:
      "GEO Epoche zeichnet nach, wie Octavians Flotte Marcus Antonius und Kleopatra vor Actium einkesselte, ihre Versorgungslinien kappte und damit das Ende der römischen Bürgerkriege einleitete.",
    immediateImpact:
      "Antonius' Niederlage führte zur Auflösung seiner Legionen und ermöglichte Octavian die Ausrufung des Principats; Ägypten wurde zur kaiserlichen Provinz und finanzierte Roms Getreideversorgung.",
    parallelsAndLessons:
      "Die Analyse zeigt, dass Seeherrschaft, Informationskontrolle und legitime Nachfolgefragen über Bürgerkriege entscheiden – Lehren, die bis zu modernen Machtwechseln reichen.",
    presentEcho:
      "Politische Kommunikation über Machtübergänge – vom Brexit bis zu Militärputschen – nutzt noch immer Narrative von Ordnung gegen Chaos, wie Octavian sie nach Actium prägte."
  },
  {
    id: "guardian-2020-brexit",
    title: "2020: Der Brexit tritt offiziell in Kraft",
    year: 2020,
    era: "Zeitgeschichte",
    region: "Vereinigtes Königreich / EU",
    source: "The Guardian",
    sourceUrl: "https://www.theguardian.com/politics/2020/jan/31/brexit-day-how-the-uk-left-the-eu",
    whatHappened:
      "The Guardian zeichnet nach, wie das Vereinigte Königreich am 31. Januar 2020 formell aus der EU austrat, die Artikel-50-Frist endete und London eine Übergangsperiode für Handels- und Sicherheitsfragen begann.",
    immediateImpact:
      "Binnenmarktregeln galten nur noch befristet, Whitehall musste Grenzabfertigung, Fischerei-Quoten und Aufenthaltsrechte neu verhandeln, während Unternehmen Lagerbestände anlegten.",
    parallelsAndLessons:
      "Der Bericht zeigt, dass Souveränität ohne funktionsfähige Verwaltungen Lieferketten gefährdet – ein Warnsignal für Staaten, die Handelsbeziehungen abrupt neu ordnen wollen.",
    presentEcho:
      "Heute ringt die britische Politik mit Divergenz-Strategien, Nordirland-Fragen und dem Fachkräftemangel – und andere Länder beobachten, wie komplex Abkopplung von supranationalen Regeln ist."
  },
  {
    id: "unfccc-2015-paris",
    title: "2015: Das Pariser Klimaabkommen wird beschlossen",
    year: 2015,
    era: "Gegenwart",
    region: "Welt",
    source: "UNFCCC",
    sourceUrl: "https://unfccc.int/process-and-meetings/the-paris-agreement",
    whatHappened:
      "Die UNFCCC dokumentiert, wie 195 Staaten in Paris ein rechtlich bindendes Rahmenwerk zur Begrenzung der Erderwärmung auf deutlich unter zwei Grad sowie nationale Klimaziele (NDCs) verabschiedeten.",
    immediateImpact:
      "Staaten mussten erstmals eigene Dekarbonisierungspfade melden, Finanzierungen für Anpassung zusagen und einen Fünf-Jahres-Zyklus für Ambitionssteigerungen akzeptieren.",
    parallelsAndLessons:
      "Das Abkommen zeigt, dass globale Transformation Transparenzregeln, Peer-Druck und technische Hilfen braucht – reine Selbstverpflichtungen reichen nicht.",
    presentEcho:
      "Aktuelle Klimapläne, CO₂-Grenzausgleiche und Loss-and-Damage-Fonds basieren auf den in Paris vereinbarten Review-Mechanismen." 
  },
  {
    id: "bbc-1994-suedafrika",
    title: "1994: Mandela gewinnt die ersten freien Wahlen Südafrikas",
    year: 1994,
    era: "Postkoloniale Bewegungen",
    region: "Südafrika",
    source: "BBC History",
    sourceUrl: "https://www.bbc.co.uk/history/historic_figures/mandela_nelson.shtml",
    whatHappened:
      "BBC History erinnert daran, wie der ANC nach Jahrzehnten Apartheid die ersten allgemeinen Wahlen gewann, Nelson Mandela Präsident wurde und eine Regierung der Nationalen Einheit bildete.",
    immediateImpact:
      "Eine Wahrheits- und Versöhnungskommission entstand, die Armee wurde integriert und neue Provinzen erhielten breite Autonomierechte.",
    parallelsAndLessons:
      "Der Übergang zeigt, dass friedliche Demokratisierung Sicherheitsgarantien für alte Eliten, inklusive Institutionen und die Aufarbeitung von Gewalt braucht.",
    presentEcho:
      "Diskussionen über Transitional Justice – von Kolumbien bis Sudan – stützen sich auf Mandalas Mischung aus juristischer Aufarbeitung und politischer Inklusion."
  },
  {
    id: "sz-1949-grundgesetz",
    title: "1949: Das Grundgesetz gründet die Bundesrepublik",
    year: 1949,
    era: "Nachkriegsordnung",
    region: "Deutschland",
    source: "Süddeutsche Zeitung Geschichte",
    sourceUrl: "https://www.sueddeutsche.de/politik/grundgesetz-1949-entstehung-",
    whatHappened:
      "Die SZ schildert, wie der Parlamentarische Rat das Grundgesetz verabschiedete, föderale Machtbalance festlegte und Grundrechte als unmittelbar geltendes Recht definierte.",
    immediateImpact:
      "Am 23. Mai 1949 entstand die Bundesrepublik Deutschland, Besatzungsmächte übergaben administrative Verantwortung und Berlin erhielt einen Sonderstatus.",
    parallelsAndLessons:
      "Der Bericht zeigt, dass stabile Demokratien robuste Verfassungsgerichte, föderale Kontrolle und klare Menschenrechtsgarantien benötigen.",
    presentEcho:
      "Verfassungsprozesse in Chile oder Tunesien verweisen auf das Grundgesetz, wenn sie richterliche Unabhängigkeit und Minderheitenschutz absichern wollen."
  },
  {
    id: "geo-313-mailand",
    title: "313: Mailänder Vereinbarung garantiert Religionsfreiheit",
    year: 313,
    era: "Spätantike",
    region: "Römisches Reich",
    source: "GEO Epoche",
    sourceUrl: "https://www.geo.de/geschichte/antike/mailaender-toleranzedikt-313",
    whatHappened:
      "GEO Epoche beschreibt, wie Kaiser Konstantin und Licinius in Mailand das Toleranzedikt veröffentlichten, Christen Gleichberechtigung zusicherten und enteignete Güter zurückgaben.",
    immediateImpact:
      "Verfolgungen endeten, Bischöfe erhielten juristische Autorität und Kirchen konnten offen bauen, während heidnische Kulte formal bestehen blieben.",
    parallelsAndLessons:
      "Die Vereinbarung zeigt, dass Religionsfreiheit politische Stabilität schaffen kann, wenn Staat und Glaubensgemeinschaften klare Kompetenzen definieren.",
    presentEcho:
      "Moderne Debatten über säkulare Verfassungen und Minderheitenschutz – von Indien bis Nigeria – greifen auf das Mailänder Modell gegenseitiger Toleranz zurück."
  },
  {
    id: "ngh-44bc-caesar",
    title: "44 v. Chr.: Die Ermordung Caesars verändert die Republik",
    year: -44,
    era: "Römische Antike",
    region: "Rom",
    source: "National Geographic History",
    sourceUrl: "https://www.nationalgeographic.com/history/article/julius-caesar-assassination",
    whatHappened:
      "National Geographic History zeichnet, wie Senatoren um Brutus und Cassius Julius Caesar an den Iden des März erstachen, um die Republik zu retten – und damit neue Bürgerkriege auslösten.",
    immediateImpact:
      "Octavian und Antonius bildeten ein Triumvirat, proskribierten Gegner und teilten die Provinzen auf.",
    parallelsAndLessons:
      "Der Bericht zeigt, dass Machtwechsel durch Gewalt selten Freiheit bringen, wenn kein tragfähiger Regierungsplan existiert.",
    presentEcho:
      "Politische Analysen zu Putschen und Attentaten verweisen auf Caesar, wenn sie die Risiken personalisierter Herrschaft beschreiben."
  },
  {
    id: "pm-history-1521-worms",
    title: "1521: Luther trotzt dem Reichstag zu Worms",
    year: 1521,
    era: "Reformation",
    region: "Heiliges Römisches Reich",
    source: "P.M. History",
    sourceUrl: "https://www.pm-history.de/reformation-reichstag-worms",
    whatHappened:
      "P.M. History zeichnet, wie Martin Luther trotz Bannandrohung sein Gewissen über die Autorität von Kaiser Karl V. und Papst stellte. Vor Fürsten, Bischöfen und Gesandten verweigerte er den Widerruf seiner Schriften und zwang das Reich, Glaubensfragen öffentlich zu verhandeln.",
    immediateImpact:
      "Kurz darauf verhängte das Wormser Edikt Reichsacht über Luther, doch sächsische Verbündete versteckten ihn auf der Wartburg. Dort übersetzte er das Neue Testament, wodurch eine gemeinsame Bibelsprache entstand und Fürsten theologischen Reformdruck bekamen.",
    parallelsAndLessons:
      "Der Bericht betont, dass Gewissensfreiheit institutionelle Rückendeckung braucht: Ohne politische Schutzmächte wäre die Reformation erstickt. Die Episode lehrt, dissidente Stimmen nicht nur zu tolerieren, sondern rechtlich zu verankern.",
    presentEcho:
      "Moderne Debatten über Whistleblower, Religionspluralismus und akademische Freiheit greifen dieses Erbe auf. Staaten, die Transparenz wollen, müssen – wie Kurfürst Friedrich der Weise – Schutzschilde für unbequeme Ideen anbieten."
  },
  {
    id: "pm-history-79-vesuv",
    title: "79 n. Chr.: Der Vesuv verschüttet Pompeji",
    year: 79,
    era: "Antike",
    region: "Römisches Reich",
    source: "P.M. History",
    sourceUrl: "https://www.pm-history.de/pompeji-vesuv-ausbruch",
    whatHappened:
      "P.M. History beschreibt anhand von Plinius dem Jüngeren, wie eine 20 Kilometer hohe Aschewolke den Golf von Neapel in Dunkelheit hüllte und Pompeji, Herculaneum sowie Stabiae unter Lapilli begrub. Handelshäuser, Thermen und Villen erstarrten in Sekunden zu archäologischen Momentaufnahmen.",
    immediateImpact:
      "Römische Behörden evakuierten Häfen Richtung Pozzuoli, während Legionäre versuchten, Überlebende per Schiff zu bergen. Die Region verlor binnen Tagen ihre wirtschaftliche Drehscheibe, woraufhin Agrarpreise im gesamten Italien stiegen.",
    parallelsAndLessons:
      "Der Bericht zeigt, wie fehlende Frühwarnsysteme Katastrophen verstärken. Bürgerliche Selbstorganisation und improvisierte Rettungswege retteten mehr Menschen als der kaiserliche Verwaltungsapparat – eine Lehre für moderne Disaster-Response-Modelle.",
    presentEcho:
        "Heute nutzen Vulkanolog:innen Satellitendaten und offene Sensor-Netzwerke, um dicht besiedelte Regionen wie Neapel oder den Ätna zu schützen. Zivilschutzübungen, Evakuierungsapps und Versicherungsfonds greifen auf Erkenntnisse aus Pompeji zurück: Resilienz entsteht vor dem Ausbruch, nicht währenddessen."
      },
  {
    id: "zeit-geschichte-1648-westfaelischer-friede",
    title: "1648: Der Westfälische Friede stabilisiert Europa",
    year: 1648,
    era: "Frühe Neuzeit",
    region: "Europa",
    source: "ZEIT Geschichte",
    sourceUrl: "https://www.zeit.de/zeit-geschichte/2020-10/westfaelischer-friede-dreissigjaehriger-krieg",
    whatHappened:
      "ZEIT Geschichte zeichnet nach, wie die Verhandler in Münster und Osnabrück nach drei Jahrzehnten Krieg neue Grenzen, Religionsrechte und diplomatische Protokolle festschrieben und damit das Prinzip souveräner Staaten etablierten.",
    immediateImpact:
      "Truppen wurden abgezogen, Söldnerheere aufgelöst und Kurfürsten erhielten mehr Autonomie, während Frankreich und Schweden Einflusszonen sicherten. Millionen Kriegsflüchtlinge mussten dennoch verwüstete Landschaften neu bestellen.",
    parallelsAndLessons:
      "Der Beitrag zeigt, dass Friedensverträge nur halten, wenn Minderheitenschutz, Schuldenfragen und Sicherheitsgarantien gemeinsam gelöst werden – eine Lehre für heutige Verhandlungen in Ukraine, Nahost oder Horn von Afrika.",
    presentEcho:
      "Multilaterale Foren wie die Vereinten Nationen greifen die in Westfalen entwickelte Idee dauerhafter Gesandtschaften und klarer Verfahrensregeln auf. Wer neue Sicherheitsarchitekturen plant, muss wie 1648 regionale und religiöse Interessen gleichermaßen würdigen."
  },
  {
    id: "spiegel-geschichte-1755-lissabon",
    title: "1755: Das Erdbeben von Lissabon erschüttert die Aufklärung",
    year: 1755,
    era: "Aufklärung",
    region: "Portugal",
    source: "SPIEGEL Geschichte",
    sourceUrl: "https://www.spiegel.de/geschichte/erdbeben-von-lissabon-1755-a-00000000",
    whatHappened:
      "SPIEGEL Geschichte beschreibt, wie ein Seebeben den 1. November 1755 in ein Flammenmeer verwandelte, Tsunamis die Häfen überrannten und Philosoph:innen wie Voltaire den Glauben an eine gottgewollte Ordnung in Frage stellten.",
    immediateImpact:
      "Premierminister Pombal ließ in Rekordzeit Notlager errichten, den Wiederaufbau mit modularen Holzrahmen beginnen und erste seismologische Erhebungen anstellen – Europas modernste Stadtplanung entstand auf den Trümmern.",
    parallelsAndLessons:
      "Die Analyse zeigt, dass Krisenkommunikation, Datenerhebung und sozialer Wiederaufbau parallel laufen müssen. Wer Entscheidungen zentralisiert, braucht transparente Kriterien, sonst kehren alte Eliten unter neuen Vorzeichen zurück.",
    presentEcho:
      "Katastrophenschutzpläne von Lissabon bis Tokio stützen sich auf Pombals Ideen: Evakuierungsachsen, Bauvorschriften und Versicherungsfonds werden heute als Versprechen politischer Handlungsfähigkeit gelesen – genau wie 1755." 
  }
];

function shuffle(items) {
  const arr = [...items];
  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

async function loadHistoryLog() {
  try {
    const raw = await fs.readFile(HISTORY_LOG_FILE, "utf-8");
    const parsed = JSON.parse(raw);
    return parsed && typeof parsed === "object" ? parsed : { used_history_ids: [] };
  } catch (error) {
    if (error.code === "ENOENT") {
      return { used_history_ids: [] };
    }
    throw error;
  }
}

async function persistHistoryLog(log, newlyUsedIds) {
  const existing = Array.isArray(log.used_history_ids) ? log.used_history_ids : [];
  const merged = Array.from(new Set([...existing, ...newlyUsedIds]));
  const payload = {
    ...log,
    used_history_ids: merged
  };

  await fs.writeFile(HISTORY_LOG_FILE, JSON.stringify(payload, null, 2));
  return payload;
}

function pickArticles(limit = DAILY_LIMIT, usedHistoryIds = []) {
  const usedSet = new Set(usedHistoryIds);
  const eligible = CURATED_ARTICLES.filter(
    (item) =>
      item.year >= MIN_YEAR &&
      item.year <= MAX_YEAR &&
      !usedSet.has(item.id)
  );
  if (eligible.length < limit) {
    throw new Error(
      `Nur ${eligible.length} ungenutzte Ereignisse innerhalb des Jahreskorridors ${MAX_YEAR} bis ${Math.abs(MIN_YEAR)} v. Chr. verfügbar, aber ${limit} erforderlich. Bitte neue Artikel ergänzen oder das History-Log zurücksetzen.`
    );
  }

  const selection = shuffle(eligible).slice(0, limit);
  return selection.sort((a, b) => b.year - a.year);
}

async function saveGeschichte(articles) {
  const payload = {
    updatedAt: new Date().toISOString(),
    articles: articles.map((article) => ({
      id: article.id,
      title: article.title,
      year: article.year,
      era: article.era,
      region: article.region,
      source: article.source,
      sourceUrl: article.sourceUrl,
      whatHappened: article.whatHappened,
      immediateImpact: article.immediateImpact,
      parallelsAndLessons: article.parallelsAndLessons,
      presentEcho: article.presentEcho
    }))
  };

  await fs.writeFile(OUTPUT_FILE, JSON.stringify(payload, null, 2));
  return payload;
}

async function main() {
  const historyLog = await loadHistoryLog();
  const usedHistoryIds = Array.isArray(historyLog.used_history_ids)
    ? historyLog.used_history_ids
    : [];
  const articles = pickArticles(DAILY_LIMIT, usedHistoryIds);
  const payload = await saveGeschichte(articles);
  await persistHistoryLog(historyLog, articles.map((article) => article.id));
  console.log(
    `Geschichte aktualisiert (${payload.articles.length} kuratierte Artikel).`
  );
}

main().catch((error) => {
  console.error("Geschichte-Update fehlgeschlagen", error);
  process.exitCode = 1;
});
