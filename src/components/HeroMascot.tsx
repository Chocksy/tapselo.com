// Cursor-following mascot in the homepage hero (prototype).
// Built on page-mascot (MIT © Kamran Ahmed, https://github.com/nilbuild/page-mascot);
// see THIRD_PARTY_NOTICES.md. To remove the mascot, see the note in Hero.astro.
// Rendered with Preact: page-mascot's `react` imports resolve to preact/compat
// (preact({ compat: true }) in astro.config.mjs).
import { useEffect, useRef, useState } from "preact/hooks";
import { Mascot } from "page-mascot";

export const MASCOT_LABEL = "Mascota Tapselo: un vânzător prietenos lângă casa de marcat";

type Props = {
  directions: string;
  reactions: string;
  size: number;
};

export default function HeroMascot({ directions, reactions, size }: Props) {
  const box = useRef<HTMLDivElement>(null);
  const [live, setLive] = useState(false);

  // The server render (and any visitor the island never hydrates for: small screens,
  // touch, prefers-reduced-motion) gets one static, decorative frame.
  useEffect(() => setLive(true), []);

  // page-mascot prefixes its label with English ("Boop the …"); keep it Romanian.
  useEffect(() => {
    box.current?.querySelector("button")?.setAttribute("aria-label", MASCOT_LABEL);
  }, [live]);

  if (!live) {
    return (
      <span
        aria-hidden="true"
        style={{
          display: "block",
          width: size,
          height: size,
          backgroundImage: `url(${directions})`,
          backgroundSize: "300% 300%",
          backgroundPosition: "50% 50%",
          backgroundRepeat: "no-repeat",
        }}
      />
    );
  }

  return (
    <div ref={box}>
      <Mascot directions={directions} reactions={reactions} size={size} label={MASCOT_LABEL} />
    </div>
  );
}
