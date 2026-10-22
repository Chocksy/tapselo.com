// Named authors for bylines and Article JSON-LD `author` (Person).

export type Author = {
  name: string;
  role: string;
  linkedin: string;
  /** 160px square under /public; `photo2x` is the 320px version. */
  photo: string;
  photo2x: string;
};

export const AUTHORS = {
  "razvan-ciocanel": {
    name: "Razvan Ciocanel",
    role: "Fondator Tapselo",
    linkedin: "https://www.linkedin.com/in/chocksy/",
    photo: "/authors/razvan-ciocanel.webp",
    photo2x: "/authors/razvan-ciocanel@2x.webp",
  },
} satisfies Record<string, Author>;

export type AuthorId = keyof typeof AUTHORS;

export function isAuthorId(v: string): v is AuthorId {
  return Object.hasOwn(AUTHORS, v);
}

/** schema.org Person for an Article `author`. */
export function authorPersonJsonLd(author: Author, site = "https://tapselo.com"): Record<string, unknown> {
  return {
    "@type": "Person",
    name: author.name,
    jobTitle: author.role,
    worksFor: { "@type": "Organization", name: "Tapselo", url: `${site}/` },
    sameAs: [author.linkedin],
    image: `${site}${author.photo2x}`,
  };
}
