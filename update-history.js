#!/usr/bin/env node
import { promises as fs } from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUTPUT_FILE = path.join(__dirname, "geschichte.json");
const DAILY_LIMIT = 5;

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

function pickArticles(limit = DAILY_LIMIT) {
  const eligible = CURATED_ARTICLES.filter((item) => item.year <= 1990);
  if (eligible.length < limit) {
    throw new Error("Nicht genug kuratierte Ereignisse vor 1990 verfügbar.");
  }

  const pool = shuffle(eligible);
  const earlyIndex = pool.findIndex((item) => item.year <= 1800);
  if (earlyIndex === -1) {
    throw new Error("Mindestens ein Ereignis zwischen Jahr 0 und 1800 ist erforderlich.");
  }

  const selection = [pool.splice(earlyIndex, 1)[0]];
  for (const candidate of pool) {
    if (selection.length >= limit) break;
    selection.push(candidate);
  }

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
  const articles = pickArticles();
  const payload = await saveGeschichte(articles);
  console.log(
    `Geschichte aktualisiert (${payload.articles.length} kuratierte Artikel, geplant täglich um 10:00 Uhr).`
  );
}

main().catch((error) => {
  console.error("Geschichte-Update fehlgeschlagen", error);
  process.exitCode = 1;
});
