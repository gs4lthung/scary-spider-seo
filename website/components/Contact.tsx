import { CONTACT } from "@/lib/site";
import { CopyEmailButton } from "@/components/CopyEmailButton";

const LINKS = [
  {
    label: "LinkedIn",
    value: CONTACT.linkedin.replace(/^https?:\/\//, ""),
    href: CONTACT.linkedin,
  },
  ...(CONTACT.phone
    ? [{ label: "Phone", value: CONTACT.phone, href: `tel:${CONTACT.phone}` }]
    : []),
];

export function Contact() {
  return (
    <section id="contact" className="mx-auto max-w-6xl px-6 py-24">
      <div className="comic-panel rounded-3xl border-[3px] border-(--color-ink) bg-card px-8 py-14 text-center sm:px-14">
        <h2 className="text-4xl font-black tracking-tight">Get in touch</h2>
        <p className="mx-auto mt-4 max-w-xl text-muted-foreground">
          Questions, feedback, or just want to say hi? Reach out directly.
        </p>

        <ul className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <li>
            <CopyEmailButton email={CONTACT.email} />
          </li>
          {LINKS.map((link) => (
            <li key={link.label}>
              <a
                href={link.href}
                target={link.href.startsWith("http") ? "_blank" : undefined}
                rel={link.href.startsWith("http") ? "noreferrer" : undefined}
                className="comic-panel-sm comic-wobble flex items-center gap-2 rounded-full border-2 border-(--color-ink) bg-secondary px-5 py-2.5 text-sm font-bold text-secondary-foreground"
              >
                <span className="text-primary">{link.label}:</span>
                {link.value}
              </a>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
