import { Navbar } from '../../components/layout/Navbar';
import { Footer } from '../../components/layout/Footer';
import { SUPPORT_EMAIL } from './SupportPage';

const UPDATED = '7 October 2026';

const sections: { title: string; body: React.ReactNode }[] = [
  {
    title: 'Who we are',
    body: (
      <p>
        Axis is a media app that runs on iPhone, iPad, Mac, Apple TV, Windows, Android TV, Samsung TV and the web. This policy explains what
        information Axis handles when you use the apps and this website, and what we do with it. Questions about it go to{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="text-accent">{SUPPORT_EMAIL}</a>.
      </p>
    ),
  },
  {
    title: 'What Axis does not do',
    body: (
      <ul>
        <li>Axis does not host, store or supply any movies, shows or other video. It displays and plays what your own Axis server provides.</li>
        <li>We do not sell your information, show advertising, or track you across other apps and websites.</li>
        <li>The apps do not use the camera, microphone, contacts, photos or your location.</li>
      </ul>
    ),
  },
  {
    title: 'Information we collect',
    body: (
      <ul>
        <li><b>Account.</b> Your email address and sign-in details, so you can sign in and so we can reach you about your account.</li>
        <li><b>Profiles.</b> Profile names, avatars and the settings you choose for each profile (for example home layout, subtitle style and language preferences).</li>
        <li><b>Your library.</b> Watchlist, custom lists, favorites, upcoming titles you follow, and what you have watched, including how far you got in a title, so Continue Watching works across your devices.</li>
        <li><b>Your Axis server connection.</b> The address, username and password for your Axis server, stored against your profile so each of your devices can sign in to it for you. While you watch, the app reports playback progress to that server.</li>
        <li><b>Device information.</b> A random identifier created on each device, the device type and app version. We use it to keep sessions working and to limit how many streams play at once. It is not your advertising ID.</li>
        <li><b>Purchases.</b> If you subscribe, Apple or Google processes the payment and tells us your plan status. We never see your card number.</li>
        <li><b>Support messages.</b> What you send us through the support form or by email, and the contact details you give.</li>
      </ul>
    ),
  },
  {
    title: 'How we use it',
    body: (
      <ul>
        <li>To run the service: sign you in, keep your profiles, library and progress in sync, and play what your server provides.</li>
        <li>To provide and bill your plan, and to answer your questions.</li>
        <li>To find and fix problems and to keep the service secure.</li>
      </ul>
    ),
  },
  {
    title: 'Services we rely on',
    body: (
      <>
        <p>We use other companies to run Axis. They handle your information only to provide their part of the service:</p>
        <ul>
          <li><b>Supabase</b> hosts our accounts and database.</li>
          <li><b>The Movie Database (TMDB)</b> supplies posters, backdrops, cast and episode information. Looking at a title means asking TMDB for its details; your account details are not sent.</li>
          <li><b>Image services</b> that deliver poster artwork and badges.</li>
          <li><b>Apple, Google and our subscription provider</b> process purchases and subscriptions.</li>
        </ul>
        <p>Your Axis server is run by us on your behalf, and it receives your playback requests and progress.</p>
      </>
    ),
  },
  {
    title: 'How long we keep it',
    body: (
      <p>
        We keep your information while your account is open. If you delete a profile, its library and progress are removed. If you ask us to delete
        your account, we delete your account and its data, except what we must keep for legal or billing reasons.
      </p>
    ),
  },
  {
    title: 'Your choices',
    body: (
      <p>
        You can see and change your profile and library in the apps and on this website. You can ask us for a copy of your information, to correct it, or
        to delete your account by writing to{' '}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="text-accent">{SUPPORT_EMAIL}</a>. Depending on where you live you may have further rights under your local
        law, and you can raise a complaint with your local data protection authority.
      </p>
    ),
  },
  {
    title: 'Children',
    body: (
      <p>
        Axis is not directed at children under 13, and we do not knowingly collect information from them. Profiles can be set up as restricted
        profiles by the account holder.
      </p>
    ),
  },
  {
    title: 'Security',
    body: <p>Connections to Axis are encrypted. No system is perfectly secure, so please use a strong, unique password.</p>,
  },
  {
    title: 'Changes to this policy',
    body: <p>If we change this policy we will update the date at the top of this page, and tell you in the app if the change is significant.</p>,
  },
];

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-bg">
      <Navbar />

      <div className="mx-auto max-w-[820px] px-5 pb-24 pt-[calc(var(--nav-h)+72px)] md:px-8 md:pt-[calc(var(--nav-h)+110px)]">
        <div className="mb-12 grid gap-4">
          <p className="text-xs font-semibold uppercase tracking-[.12em] text-accent">Privacy</p>
          <h1 className="text-[clamp(36px,5vw,60px)] font-semibold leading-[1.05]">Privacy policy</h1>
          <p className="text-sm text-muted">Last updated {UPDATED}</p>
        </div>

        <div className="grid gap-10">
          {sections.map((s) => (
            <section key={s.title} className="grid gap-3">
              <h2 className="text-xl font-semibold tracking-tight">{s.title}</h2>
              <div className="grid gap-3 text-[15.5px] leading-relaxed text-muted [&_b]:font-semibold [&_b]:text-text [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_ul]:grid [&_ul]:gap-2">
                {s.body}
              </div>
            </section>
          ))}
        </div>
      </div>

      <Footer />
    </div>
  );
}
