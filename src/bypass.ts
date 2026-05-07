const GOOGLEBOT_UA =
  "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)";
const BINGBOT_UA =
  "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)";
const GOOGLE_REFERER = "https://www.google.com/";
const FACEBOOK_REFERER = "https://www.facebook.com/";
const TWITTER_REFERER = "https://twitter.com/";

interface BypassRule {
  ua?: string;
  referer?: string;
}

const domainRules = new Map<string, BypassRule>();

function add(domains: string[], rule: BypassRule): void {
  for (const d of domains) domainRules.set(d, rule);
}

add(["abc.es"], { ua: "googlebot" });
add(["aftonbladet.se"], { ua: "googlebot" });
add(["al.com", "cleveland.com", "lehighvalleylive.com", "masslive.com", "mlive.com",
  "nj.com", "oregonlive.com", "pennlive.com", "silive.com", "syracuse.com"], {});
add(["arvopaperi.fi", "iltalehti.fi", "kauppalehti.fi", "marmai.fi", "mediuutiset.fi",
  "mikrobitti.fi", "talouselama.fi", "tekniikkatalous.fi", "tivi.fi", "uusisuomi.fi"], { ua: "googlebot" });
add(["ara.cat", "arabalears.cat"], { ua: "googlebot" });
add(["adelaidenow.com.au", "cairnspost.com.au", "codesports.com.au", "couriermail.com.au",
  "dailytelegraph.com.au", "geelongadvertiser.com.au", "goldcoastbulletin.com.au",
  "heraldsun.com.au", "ntnews.com.au", "theaustralian.com.au", "thechronicle.com.au",
  "themercury.com.au", "townsvillebulletin.com.au", "weeklytimesnow.com.au"], { ua: "googlebot" });
add(["bnn.de"], { ua: "googlebot" });
add(["barrons.com"], { ua: "googlebot" });
add(["berlingske.dk"], { ua: "googlebot" });
add(["bloomberg.com"], {});
add(["bonappetit.com", "gq.com", "newyorker.com", "vanityfair.com", "vogue.com", "wired.com"], { ua: "googlebot" });
add(["di.se"], { ua: "googlebot" });
add(["dn.se"], { ua: "googlebot" });
add(["tijd.be"], { referer: "google" });
add(["demorgen.be", "humo.be", "parool.nl", "trouw.nl", "volkskrant.nl"], {});
add(["deutsche-wirtschafts-nachrichten.de"], { ua: "googlebot" });
add(["df.cl"], { ua: "googlebot" });
add(["rheinpfalz.de"], { ua: "googlebot" });
add(["zeit.de"], { ua: "googlebot" });
add(["editorialedomani.it"], { ua: "googlebot" });
add(["elmercurio.com"], { ua: "googlebot" });
add(["elmundo.es", "expansion.com", "marca.com"], { ua: "googlebot" });
add(["espn.com"], {});
add(["esprit.presse.fr"], {});
add(["euobserver.com"], { ua: "googlebot" });
add(["eurekareport.com.au"], { ua: "googlebot" });
add(["fnlondon.com"], { ua: "googlebot" });
add(["ft.com"], { ua: "googlebot" });
add(["fd.nl"], { referer: "facebook" });
add(["folha.uol.com.br", "blogfolha.uol.com.br"], { ua: "googlebot" });
add(["forbes.com"], {});
add(["foreignaffairs.com"], {});
add(["foreignpolicy.com"], {});
add(["fortune.com"], {});
add(["faz.net"], {});
add(["abendblatt.de", "braunschweiger-zeitung.de", "morgenpost.de", "nrz.de",
  "otz.de", "thueringer-allgemeine.de", "tlz.de", "waz.de", "wp.de", "wr.de"], { ua: "googlebot" });
add(["azcentral.com", "cincinnati.com", "courier-journal.com", "detroitnews.com",
  "freep.com", "indystar.com", "jsonline.com", "northjersey.com", "statesman.com", "tennessean.com"], { ua: "googlebot" });
add(["gelocal.it", "huffingtonpost.it", "ilsecoloxix.it", "italian.tech",
  "lanuovasardegna.it", "lastampa.it", "lescienze.it", "limesonline.com", "repubblica.it"], { ua: "googlebot" });
add(["genomeweb.com", "360dx.com", "precisiononcologynews.com"], {});
add(["aisnenouvelle.fr", "courrier-picard.fr", "lardennais.fr", "lavoixdunord.fr",
  "lesoir.be", "lest-eclair.fr", "liberation-champagne.fr", "lunion.fr",
  "nordeclair.fr", "nordlittoral.fr", "paris-normandie.fr", "sudinfo.be"], { ua: "googlebot" });
add(["haaretz.com", "haaretz.co.il"], { ua: "bingbot" });
add(["handelsblatt.com"], { ua: "googlebot" });
add(["expressnews.com", "houstonchronicle.com", "sfchronicle.com"], {});
add(["intelligentinvestor.com.au"], { ua: "googlebot" });
add(["investorschronicle.co.uk"], { referer: "google" });
add(["lecho.be"], { referer: "google" });
add(["nouvelobs.com"], { ua: "googlebot" });
add(["usinenouvelle.com"], { ua: "googlebot" });
add(["lalibre.be"], { ua: "googlebot" });
add(["law.com"], { referer: "facebook" });
add(["law360.com"], { referer: "twitter" });
add(["leparisien.fr"], { ua: "googlebot" });
add(["lenouveleconomiste.fr"], { ua: "googlebot" });
add(["mainichi.jp"], { ua: "googlebot" });
add(["sloanreview.mit.edu"], { referer: "facebook" });
add(["nationalgeographic.com"], {});
add(["nationalreview.com"], { ua: "googlebot" });
add(["nzz.ch"], { ua: "googlebot" });
add(["newleftreview.org"], { ua: "googlebot" });
add(["nzherald.co.nz"], { ua: "bingbot" });
add(["intrafish.com", "rechargenews.com", "tradewindsnews.com", "upstreamonline.com"], { referer: "facebook" });
add(["piqd.de"], { ua: "googlebot" });
add(["quora.com"], { ua: "googlebot" });
add(["rhein-zeitung.de"], { ua: "googlebot" });
add(["aamulehti.fi", "hs.fi"], { ua: "googlebot" });
add(["seekingalpha.com"], {});
add(["stratfor.com"], { ua: "bingbot" });
add(["statista.com"], { referer: "google" });
add(["telerama.fr"], { ua: "googlebot" });
add(["brisbanetimes.com.au", "smh.com.au", "theage.com.au", "watoday.com.au"], {});
add(["theatlantic.com"], {});
add(["dallasnews.com"], { ua: "googlebot" });
add(["economictimes.com", "economictimes.indiatimes.com"], { ua: "googlebot" });
add(["theglobeandmail.com"], {});
add(["hilltimes.com"], { ua: "googlebot" });
add(["thelawyersdaily.ca"], { ua: "googlebot" });
add(["themarker.com"], { ua: "bingbot" });
add(["themarket.ch"], { ua: "googlebot" });
add(["nytimes.com"], {});
add(["timeshighereducation.com"], {});
add(["timesofindia.com", "timesofindia.indiatimes.com"], { ua: "googlebot" });
add(["wsj.com"], {});
add(["washingtonpost.com"], {});
add(["usatoday.com"], { ua: "googlebot" });
add(["voguebusiness.com"], { ua: "googlebot" });
add(["westfalen-blatt.de"], { ua: "googlebot" });
add(["wn.de"], { ua: "googlebot" });
add(["worldpoliticsreview.com"], { ua: "googlebot" });
add(["wz.de"], { ua: "googlebot" });
add(["adweek.com"], {});
add(["allgaeuer-zeitung.de"], {});
add(["alternatives-economiques.fr"], {});
add(["ambito.com"], {});
add(["americanaffairsjournal.org"], {});
add(["americanbanker.com"], {});
add(["apollo-magazine.com"], {});
add(["artnet.com"], {});
add(["asiatimes.com"], {});
add(["atavist.com"], {});
add(["atlantico.fr"], {});
add(["augsburger-allgemeine.de"], {});
add(["automobilwoche.de"], {});
add(["belfasttelegraph.co.uk"], {});
add(["berliner-zeitung.de"], {});
add(["bloombergquint.com"], {});
add(["businessinsider.com"], {});
add(["business-standard.com"], {});
add(["causeur.fr"], {});
add(["cen.acs.org"], {});
add(["challenges.fr"], {});
add(["charliehebdo.fr"], {});
add(["chronicle.com"], {});
add(["cicero.de"], {});
add(["clarin.com"], {});
add(["cmjornal.pt"], {});
add(["commentary.org"], {});
add(["connaissancedesarts.com"], {});
add(["corriere.it"], {});
add(["corrieredellosport.it"], {});
add(["adage.com", "autonews.com", "chicagobusiness.com", "crainscleveland.com",
  "crainsdetroit.com", "crainsnewyork.com", "modernhealthcare.com"], {});
add(["cw.com.tw"], {});
add(["darkreading.com"], {});
add(["digiday.com"], {});
add(["discovermagazine.com"], {});
add(["eastwest.eu"], {});
add(["elconfidencial.com"], {});
add(["eldiario.es"], {});
add(["elespanol.com"], {});
add(["elespectador.com"], {});
add(["elle.fr"], {});
add(["elpais.com"], {});
add(["elperiodico.com"], {});
add(["eltiempo.com"], {});
add(["enotes.com"], {});
add(["entrepreneur.com"], {});
add(["exame.com"], {});
add(["finance.si"], {});
add(["firstthings.com"], {});
add(["freiepresse.de"], {});
add(["bienpublic.com", "dna.fr", "estrepublicain.fr", "lalsace.fr", "ledauphine.com",
  "lejsl.com", "leprogres.fr", "republicain-lorrain.fr", "vosgesmatin.fr"], {});
add(["centrepresseaveyron.fr", "ladepeche.fr", "lindependant.fr", "midi-olympique.fr",
  "midilibre.fr", "nrpyrenees.fr", "petitbleu.fr"], {});
add(["monacomatin.mc", "nicematin.com", "varmatin.com"], {});
add(["sudouest.fr", "charentelibre.fr", "larepubliquedespyrenees.fr"], {});
add(["glassdoor.com"], {});
add(["globes.co.il"], {});
add(["griffithreview.com"], {});
add(["groene.nl"], {});
add(["abril.com.br"], {});
add(["diariocorreo.pe", "elcomercio.pe", "gestion.pe"], {});
add(["diariodemallorca.es", "eldia.es", "epe.es", "farodevigo.es", "informacion.es",
  "laprovincia.es", "levante-emv.com", "lne.es", "mallorcazeitung.es"], {});
add(["diariosur.es", "diariovasco.com", "elcomercio.es", "elcorreo.com",
  "eldiariomontanes.es", "elnortedecastilla.es", "hoy.es", "ideal.es",
  "larioja.com", "lasprovincias.es", "laverdad.es", "lavozdigital.es"], {});
add(["harpers.org"], {});
add(["hbr.org"], {});
add(["hbrchina.org"], {});
add(["bicycling.com", "cosmopolitan.com", "countryliving.com", "elle.com",
  "esquire.com", "goodhousekeeping.com", "hollywoodreporter.com", "housebeautiful.com",
  "menshealth.com", "popularmechanics.com", "prevention.com", "roadandtrack.com",
  "runnersworld.com", "townandcountrymag.com", "womenshealthmag.com"], {});
add(["hindustantimes.com"], {});
add(["staradvertiser.com"], {});
add(["historyextra.com"], {});
add(["ilfattoquotidiano.it"], {});
add(["ilfoglio.it"], {});
add(["corriereadriatico.it", "ilgazzettino.it", "ilmattino.it", "ilmessaggero.it", "quotidianodipuglia.it"], {});
add(["inc.com"], {});
add(["inc42.com"], {});
add(["indiatoday.in"], {});
add(["inkl.com"], {});
add(["internazionale.it"], {});
add(["independent.ie"], {});
add(["italiaoggi.it"], {});
add(["ipolitics.ca"], {});
add(["knack.be"], {});
add(["ksta.de"], {});
add(["krautreporter.de"], {});
add(["kurier.at"], {});
add(["lequipe.fr"], {});
add(["lexpress.fr"], {});
add(["loeildelaphotographie.com"], {});
add(["lopinion.fr"], {});
add(["la-croix.com"], {});
add(["lamontagne.fr"], {});
add(["lanacion.com.ar"], {});
add(["lanouvellerepublique.fr"], {});
add(["lasegunda.com"], {});
add(["latercera.com"], {});
add(["latribune.fr"], {});
add(["lavanguardia.com"], {});
add(["lavie.fr"], {});
add(["ledevoir.com"], {});
add(["lejdd.fr"], {});
add(["journaldunet.com"], {});
add(["lesechos.fr"], {});
add(["lesinrocks.com"], {});
add(["livelaw.in"], {});
add(["livemint.com"], {});
add(["loebclassics.com"], {});
add(["lrb.co.uk"], {});
add(["labusinessjournal.com"], {});
add(["latimes.com"], {});
add(["haz.de", "kn-online.de", "ln-online.de", "lvz.de", "maz-online.de",
  "neuepresse.de", "ostsee-zeitung.de", "rnd.de"], {});
add(["marianne.net"], {});
add(["marketwatch.com"], {});
add(["bnd.com", "charlotteobserver.com", "fresnobee.com", "kansas.com",
  "kansascity.com", "kentucky.com", "miamiherald.com", "newsobserver.com",
  "sacbee.com", "star-telegram.com", "thestate.com", "tri-cityherald.com"], {});
add(["gva.be", "hbvl.be", "nieuwsblad.be"], {});
add(["gooieneemlander.nl", "haarlemsdagblad.nl", "ijmuidercourant.nl",
  "leidschdagblad.nl", "noordhollandsdagblad.nl"], {});
add(["dvhn.nl", "lc.nl"], {});
add(["medianama.com"], {});
add(["denverpost.com", "eastbaytimes.com", "mercurynews.com", "ocregister.com",
  "pe.com", "twincities.com"], {});
add(["medium.com", "betterprogramming.pub", "towardsdatascience.com"], {});
add(["mexiconewsdaily.com"], {});
add(["mid-day.com"], {});
add(["technologyreview.com"], {});
add(["mz.de"], {});
add(["mv-voice.com"], {});
add(["muensterschezeitung.de"], {});
add(["nautil.us"], {});
add(["noz.de"], {});
add(["curbed.com", "grubstreet.com", "nymag.com", "thecut.com", "vulture.com"], {});
add(["newsday.com"], {});
add(["newsweek.com"], {});
add(["asia.nikkei.com"], {});
add(["nwzonline.de"], {});
add(["nrc.nl"], {});
add(["nn.de"], {});
add(["nyteknik.se"], {});
add(["estadao.com.br"], {});
add(["globo.com"], {});
add(["observador.pt"], {});
add(["outlookindia.com"], {});
add(["backpacker.com", "betamtb.com", "betternutrition.com", "cleaneatingmag.com",
  "climbing.com", "cyclingtips.com", "gymclimber.com", "outsideonline.com",
  "oxygenmag.com", "pelotonmagazine.com", "podiumrunner.com", "rockandice.com",
  "skimag.com", "trailrunnermag.com", "triathlete.com", "vegetariantimes.com",
  "velonews.com", "womensrunning.com", "yogajournal.com"], {});
add(["paloaltoonline.com"], {});
add(["parismatch.com"], {});
add(["billboard.com", "rollingstone.com", "sportico.com", "variety.com", "wwd.com"], {});
add(["philosophynow.org"], {});
add(["post-gazette.com"], {});
add(["politicaexterior.com"], {});
add(["calgaryherald.com", "financialpost.com", "nationalpost.com", "theprovince.com",
  "torontosun.com", "vancouversun.com"], {});
add(["prospectmagazine.co.uk"], {});
add(["puck.news"], {});
add(["qz.com"], {});
add(["ilgiorno.it", "ilrestodelcarlino.it", "iltelegrafolivorno.it", "lanazione.it",
  "quotidiano.net"], {});
add(["reuters.com"], {});
add(["rugbypass.com"], {});
add(["spglobal.com"], {});
add(["sandiegouniontribune.com"], {});
add(["shz.de"], {});
add(["svz.de"], {});
add(["science.org"], {});
add(["science-et-vie.com"], {});
add(["sciencesetavenir.fr"], {});
add(["scientificamerican.com"], {});
add(["slate.com"], {});
add(["slideshare.net"], {});
add(["sofrep.com"], {});
add(["scmp.com"], {});
add(["infzm.com"], {});
add(["si.com"], {});
add(["startribune.com"], {});
add(["stocknews.com"], {});
add(["study.com"], {});
add(["tampabay.com"], {});
add(["techinasia.com"], {});
add(["telegraaf.nl"], {});
add(["nola.com", "theadvocate.com"], {});
add(["theartnewspaper.com"], {});
add(["theathletic.com", "theathletic.co.uk"], {});
add(["ajc.com"], {});
add(["afr.com"], {});
add(["bostonglobe.com"], {});
add(["bizjournals.com"], {});
add(["businessoffashion.com"], {});
add(["csmonitor.com"], {});
add(["thedailybeast.com"], {});
add(["dailywire.com"], {});
add(["thediplomat.com"], {});
add(["economist.com"], {});
add(["financialexpress.com"], {});
add(["thehindu.com"], {});
add(["thehindubusinessline.com"], {});
add(["independent.co.uk"], {});
add(["indianexpress.com"], {});
add(["theintercept.com"], {});
add(["jpost.com"], {});
add(["thenation.com"], {});
add(["thenewatlantis.com"], {});
add(["newrepublic.com"], {});
add(["newstatesman.com"], {});
add(["nybooks.com"], {});
add(["inquirer.com"], {});
add(["spectatorworld.com", "spectator.co.uk"], {});
add(["thestar.com"], {});
add(["telegraph.co.uk"], {});
add(["thetimes.co.uk"], {});
add(["thewrap.com"], {});
add(["baltimoresun.com", "capitalgazette.com", "chicagotribune.com", "courant.com",
  "dailypress.com", "mcall.com", "nydailynews.com", "orlandosentinel.com",
  "pilotonline.com", "sun-sentinel.com"], {});
add(["unherd.com"], {});
add(["valeursactuelles.com"], {});
add(["venturebeat.com"], {});
add(["volksstimme.de"], {});
add(["vn.nl"], {});
add(["winnipegfreepress.com"], {});
add(["britannica.com"], {});
add(["aftenposten.no"], {});
add(["the-american-interest.com"], {});
add(["historyextra.com"], {});
add(["ftm.nl"], {});
add(["rundschau-online.de"], {});
add(["bendigoadvertiser.com.au", "bordermail.com.au", "canberratimes.com.au",
  "centralwesterndaily.com.au", "dailyadvertiser.com.au", "dailyliberal.com.au",
  "examiner.com.au", "illawarramercury.com.au", "newcastleherald.com.au",
  "northerndailyleader.com.au", "standard.net.au", "theadvocate.com.au",
  "thecourier.com.au", "westernadvocate.com.au"], {});
add(["nation.africa"], {});
add(["franc-tireur.fr"], {});
add(["lesechos.fr"], {});
add(["buffalonews.com", "journalnow.com", "richmond.com", "tucson.com", "tulsaworld.com"], {});

export interface BypassHeaders {
  "User-Agent"?: string;
  "Referer"?: string;
}

export function getBypassHeaders(url: string): BypassHeaders {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    const rule = domainRules.get(hostname);
    if (!rule) return {};
    const headers: BypassHeaders = {};
    if (rule.ua === "googlebot") headers["User-Agent"] = GOOGLEBOT_UA;
    else if (rule.ua === "bingbot") headers["User-Agent"] = BINGBOT_UA;
    if (rule.referer === "google") headers["Referer"] = GOOGLE_REFERER;
    else if (rule.referer === "facebook") headers["Referer"] = FACEBOOK_REFERER;
    else if (rule.referer === "twitter") headers["Referer"] = TWITTER_REFERER;
    return headers;
  } catch {
    return {};
  }
}

export function extractDomain(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function isBypassSupported(url: string): boolean {
  return domainRules.has(extractDomain(url));
}

export function getSupportedDomains(): string[] {
  return Array.from(domainRules.keys()).sort();
}
