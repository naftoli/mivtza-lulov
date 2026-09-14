import { Card, SectionHeader, Button } from '../components/ui.jsx'
import { LULAV_DAYS, ordinal } from '../lib/succos.js'

// Numbered step on a sky card: green-deep circle badge with a white Exo Black numeral
// (page content, so not the condensed face).
function Step({ n, title, children }) {
  return (
    <Card className="p-5 sm:p-6">
      <div className="flex items-start gap-4">
        <span className="grid h-11 w-11 flex-none place-items-center rounded-full bg-green font-display text-[20px] font-black leading-none text-white">{n}</span>
        <div className="min-w-0">
          <h3 className="font-display text-xl font-bold text-navy">{title}</h3>
          <div className="mt-1 text-[15px] leading-relaxed text-navy/90">{children}</div>
        </div>
      </div>
    </Card>
  )
}

export default function HowTo() {
  return (
    <div>
      <section className="hero-navy">
        <div className="mx-auto max-w-3xl px-4 py-10 sm:py-12">
          <p className="font-display text-[15px] font-semibold uppercase tracking-[0.1em] text-gold sm:text-lg">Mivtza Lulav · Soldier's Guide</p>
          <h1 className="mt-2 font-display text-3xl font-black uppercase leading-[1.15] text-white sm:text-4xl">How to shake Lulav &amp; Esrog</h1>
          <p className="mt-3 max-w-xl text-lg text-white/85">
            A quick guide so you can do the mitzvah — and help another Yid do it too. 🌿
          </p>
        </div>
      </section>

      <div className="mx-auto max-w-3xl space-y-5 px-4 py-8">
        {/* Bracha */}
        <Card className="p-6">
          <SectionHeader>The Bracha</SectionHeader>
          <p className="mt-1 text-sm text-muted">Say this <strong className="text-navy">before</strong> shaking (during the day, and not on Shabbos):</p>
          <div className="mt-4 rounded-[20px] bg-paper p-5 text-center">
            <p className="font-heb text-2xl leading-relaxed text-navy" dir="rtl">
              בָּרוּךְ אַתָּה ה׳ אֱלֹקֵינוּ מֶלֶךְ הָעוֹלָם, אֲשֶׁר קִדְּשָׁנוּ בְּמִצְוֺתָיו וְצִוָּנוּ עַל נְטִילַת לוּלָב.
            </p>
            <p className="mt-3 text-sm italic text-muted">
              Boruch Atoh Ado-noy Elo-keinu Melech ho'olom, asher kideshonu bemitzvosov vetzivonu al netilas lulav.
            </p>
            <p className="mt-2 text-sm text-navy/80">
              “Blessed are You… who sanctified us with His mitzvos and commanded us about taking the lulav.”
            </p>
          </div>
          <p className="mt-3 text-sm text-muted">
            The <strong className="text-navy">first time</strong> you shake Lulav this Succos (the first day that isn't Shabbos — this year, the <strong className="text-navy">{ordinal(LULAV_DAYS[0])} day</strong>), also say <strong className="text-navy">Shehecheyanu</strong>.
          </p>
        </Card>

        <Step n="1" title="Get your set ready">
          Your set is the <strong>lulav</strong> (palm) bound with <strong>3 hadassim</strong> (myrtle) and <strong>2 aravos</strong> (willow), plus the <strong>esrog</strong>. Make sure it's daytime and <strong>not Shabbos</strong>.
        </Step>

        <Step n="2" title="Hold it right">
          Take the <strong>lulav in your right hand</strong> (spine facing you). Hold the <strong>esrog in your left hand</strong> — with the <strong>pitom (tip) pointing down</strong> while you say the bracha. Then turn the esrog <strong>right-side up</strong> and bring both hands together.
        </Step>

        <Step n="3" title="Shake in every direction (na'anuim)">
          Gently shake the lulav &amp; esrog <strong>three times in each direction</strong> — to the sides, forward, up, and down — bringing them back to your heart each time. Follow your family's or school's <strong>minhag</strong> for the exact order.
        </Step>

        <Step n="4" title="Help another Yid 🎖️">
          This is the mivtza! Politely offer to help a fellow Yid do the mitzvah: hand them the set, help them make the bracha and shake, then wish them a <strong>Gut Yom Tov</strong>. Every person you help counts!
        </Step>

        <Step n="5" title="Log your shakes">
          Come back to the app and record how many people you helped — add a photo and your story too. Watch your school climb toward its goal!
        </Step>

        {/* Callout — green-deep panel, gold lead-in, white copy */}
        <div className="rounded-[28px] bg-green p-5 text-white shadow-card sm:p-6">
          <p className="text-sm text-white/90">
            <strong className="text-gold">Not sure about something?</strong> Always ask your teacher, counselor, or rabbi — they'll be happy to show you.
          </p>
        </div>

        <div className="flex flex-wrap gap-3 pt-2">
          <Button to="/login" variant="gold">I'm ready — Log my shakes 🌿</Button>
          <Button to="/" variant="outline">See the campaigns</Button>
        </div>
      </div>
    </div>
  )
}
