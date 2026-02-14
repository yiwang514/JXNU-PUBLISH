import React from 'react';

export const SiteFooter: React.FC<{ className?: string }> = ({ className = '' }) => (
  <footer className={className}>
    <span>© 2026 </span>
    <a
      href="https://blog.guiguisocute.cloud/"
      target="_blank"
      rel="noreferrer"
      className="font-semibold text-primary underline-offset-2 hover:underline"
    >
      guiguisocute
    </a>
    <span>. All Rights Reserved. </span>
    <a
      href="/rss.xml"
      target="_blank"
      rel="noreferrer"
      className="font-semibold text-primary underline-offset-2 hover:underline"
    >
      RSS
    </a>
    <br />
    <span>Powered by </span>
    <a
      href="https://github.com/guiguisocute/JXNU-PUBLISH"
      target="_blank"
      rel="noreferrer"
      className="font-semibold text-primary underline-offset-2 hover:underline"
    >
      JXNU-PUBLISH
    </a>
    <span> &amp; </span>
    <a
      href="https://openclaw.ai/"
      target="_blank"
      rel="noreferrer"
      className="font-semibold text-primary underline-offset-2 hover:underline"
    >
      OpenClaw
    </a>
  </footer>
);
