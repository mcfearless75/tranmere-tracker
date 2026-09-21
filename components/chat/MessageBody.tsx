import { tokenizeLinks } from '@/lib/chat/linkify'

/**
 * Renders a chat message body, turning any URLs in it into real anchors.
 *
 * `mine` picks the link colour: own messages sit on the solid blue bubble,
 * everyone else's on white, and a single link colour is unreadable on both.
 */
export function MessageBody({ body, mine }: { body: string; mine: boolean }) {
  const tokens = tokenizeLinks(body)

  return (
    <p className="whitespace-pre-wrap">
      {tokens.map((token, i) =>
        token.type === 'link' ? (
          <a
            key={i}
            href={token.href}
            target="_blank"
            rel="noopener noreferrer"
            // `break-all` so a long OneDrive link can't push the bubble
            // past the 75% max-width on a phone.
            className={`underline underline-offset-2 break-all ${
              mine ? 'text-white font-medium' : 'text-tranmere-blue'
            }`}
          >
            {token.value}
          </a>
        ) : (
          <span key={i}>{token.value}</span>
        ),
      )}
    </p>
  )
}
