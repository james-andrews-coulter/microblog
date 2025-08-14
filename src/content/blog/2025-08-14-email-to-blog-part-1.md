---
title: 'email to blog part 1'
pubDate: '2025-08-14T14:17:25.000Z'
---

built a cool proof of concept today for a microblog i’ve been itching to start

the idea is to make blogging as low-stakes, sincere, and enjoyable as emailing an old friend

except as opposed going to a single recipient, it gets syndicated to the fediverse from my stake on the indie web. a kind of: “here i am internet, let’s make friends”

it’s super appealing to me because i’m not one for ‘broadcasting’, but i’m always scribbling notes and responsive on email. so, why not latch onto those familiar interfaces and behaviours?

how it works is:
i send an email (like the words you’re reading, actually) to my postmark inbound server 
postmark sends the message JSON to cloudflare worker webhook 
cloudflare worker processes message into markdown and adds to my astro blog on github marked up with indieweb microformatting
github deploys via actions to github pages
it was fun learning about free services like postmark, cloudflare workers, and to get a better grip on astro by customising my second theme. wish they taught us this instead of custom wordpress development in school..

tomorrow, i’ll try and setup bridgy, webmentions, and indieauth and fully POSSE up this place 
