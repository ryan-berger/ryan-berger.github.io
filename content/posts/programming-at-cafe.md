---
title: "Programming at a Cafe at the End of the Universe"
date: 2025-03-28T17:34:30-07:00
searchHidden: true
draft: true
---

Hello! My name is Ryan Berger, I'm a 24 year old software developer living in Seattle, WA. This is the first real post of
my blog, and oh boy is it a doozy!

To cut it short: in the coming months, I will be undergoing a bilateral lung transplant at the University of Washington.
I have - since I was 13 - known this was coming, but my lung function and blood tests show that I am not too far off from
respiratory failure. My doctors have determined that I am in good shape and my particular circumstances make recovery hard
so I need to be as healthy as possible going into it.

However, if you know me or have met me, you probably would not have guessed this is where I'm at. I currently work a full time job
at a large software company. I work on compiler security, which is an interesting intersection that until recently I didn't know
existed! I have a normal-ish social life. I play chess at the local chess club, have a beer every once and a while, but try to avoid
crowds like concerts, and if I do go I mask up. I hang out at Espresso Vivace in Capitol Hill almost every day, as they have some of
the best coffee in the world (I'm not joking, in fact, they're world renowned!)

Lung transplants are no joke, especially mine. Although small, there is a chance that I won't make it or will end up fully disabled.
I wouldn't take this option if I didn't think it would give me a better quality of life than I had before. All lung transplants
end in chronic rejection of the organ, so at a minimum I have that to look forward to. 
However, because of a bonemarrow transplant I had at 6 months old, I am currently going through that song and dance of my stem cell transplant 
rejecting my lungs. It's a bit different, but similar enough that I'm willing to ride the ride a second time. And even better, this time I'll
get to use a much fuller immunosuppressive and anti-rejection regime because having a different set of lungs and keeping them healthy will override
all of my current concerns of being immunosuppressed.

Because of this chance, I wanted to write a short post about the things that I've done that I'm proud of, the small amount of travelling I've done and
places I've seen, some things that make me happy that I want to share with others, and some hard-fought knowledge I've learned. This post isn't me memorializing,
myself because I plan on getting out of this okay, so I'll leave a sneak peak of what I plan on doing once my lungs are no longer diseased

## Things I'm Proud Of

### First Coding Job

Although Bryan Cantrill's talk heavily applies here, I'm extremely happy that I was able to quickly learn programming between the ages of 12-15,
enough that when I was 16 (of working legal age in the US) that I was able to apply for a job at a local DevShop. I intially started out as a mentee
through a local middle school program, and it slowly evolved into a job. My mentors there set me on the right track and taught me invaluable software
skills that they had learned from being the launchpad for many startups around Utah. Ahead of my peers, I knew to ship early and often, how and when
to start optimizing, software architecture skills, and how to work in a team. 

### Eagle Scout

A lot of Eagle Scouts pre-2018 from Utah are due to the large-scale standardization of the Scouting program that the LDS (/Mormon) church for their
young men between the ages of 12 and 18. Many of these projects are carried out by their parents and generally barely check the boxes by doing something
along the lines of a blood drive, or food drive. They require little to no extra work, and require little to no extra care for the communities they serve.

I decided that I didn't want my project to be like that. I visited the Ronald McDonald House of Salt Lake City and noticed their computer lab was lacking,
and since many familes are uprooted to 

### Senor Wooly

Senor Wooly is one of my greatest engineering acheivements. At 19 I was a broke college student who was looking for a one-off side gig to make extra cash.
I went on UpWork and found a familiar face. Sr. Wooly, the Spanish language learning program I used in high school. After an interview, Jim Wooldridge
(Sr. Wooly himself) decided to give me a chance because I was a) an Eagle Scout and b) I used Sr. Wooly in junior high.

After a full summer of work, I rolled out a new and revamped Teacher site. It was FLASHY. It had a statistics dashboard (shout out to my first job for 
teaching me how to make efficient statistical dashboards) and tons of new teacher management features. After an all-night rollout and a few outages here or
there, I noticed the technical debt from my and previous developers were building up. Our hosting was a mess, and everything was extremely overprovisioned
due to a well-documented memory leak in the Gorilla Mux library from Go pre 1.13. After an upgrade, dashboard, metrics, monitoring, an eventual migration
to a PaaS to only scale up during the day, and a Graphic Novel reader, my work there was done. It had been 4 years and the level of on call and Everything
Man work that I had to do was too much for me.

It has been interesting to look back on that experience as I believe it took me from a junior engineer to a senior engineer over 4 to 5 years. It gave me
tons of experience talking with non-technical people, interfacing with the school district IT staff. I was essentially a CTO without the title, or a founding
engineer if you will. I had to balance tons of technical and people requirements and I got to see first hand how my decisions played out. I had to be
_just that good_ or else a lot would fall apart.

### Graduating College

To keep this short, college for the first 2.5 years was extremely easy for me due to the above programming experience. The last 1.5 I really pushed myself
and got into Distributed Systems (by implementing Raft) and doing a self-study (thanks to John Regehr and Ryan Stutsman). 
I took a graduate-level operating systems course, along with a compilers course taught by John Regehr. 
For my senior capstone, I then worked on ARM-TV, an ARM lifter that attempts to lift ARM code back into LLVM IR in a semantics
preserving way. Before the project was taken over by a few of my fellow students as I was on the way out the door, it even found a couple of bugs from global-isel
in the backend!

I think without pushing myself to the next level of developer and pushing through the numerous hard classes I wouldn't be the developer (or person!) I am today.
Cruising through high school and most of college was extremely detrimental to me, and it was good to finally be required to work hard to achieve my aims.

### Gaining Weight

For most of my life, I was a whopping 94/95lbs (43kg for the enlightened) at 5'7". Why? Lots of reasons. My lungs work 2-4 times harder than the normal person
which requires a serious "eat anything you can" lifestyle. Before it was an adult, it was mostly blamed on the fact that my dad wasn't too far off my weight
when I was his age, so it must just be genetic. At some point however, that started to become a problem. I was told that there would be no option for a lung
transplant if I kept my weight, and the lack of weight was causing prolonged hospitalizations after surgeries as it took a while for me to heal.

A bit over a year ago I decided enough was enough and that even if it took getting a feeding tube I'd become a normal weight. I saw 130lbs (~60kg) as an unacheivable
mountain that could never be summitted. However, after getting a permanent feeding tube placed and pushing myself to eat more and more, I eventually gained 35 pounds
in a year, even with an H. Pylori infection that left me nauseous!

### Keeping Active

One reason many people don't realize that I'm disabled is because of how active I have been. 

## Things I've Learned


### I'm Not a Temporarily-Disabled Able-Bodied Person.

This sounds stupid, but it has been a hard lesson. A few times in the past 5 years I've gotten close to my doctors declaring me disabled, at which point I would
no longer be working full time, and would instead take disability checks from Social Security. However, as many Americans are aware, the social safety nets here
are atrocious. Even though I would no longer be fit to work, I would need to wait an extended amount of time to qualify for disability because I have a savings account
that had thousands in it. Not until I had under $2,000 in assets would my checks kick in.

Even though I did many things to attempt to plan against this, I still didn't get it through my thick skull that I was _partially_ disabled, and my lungs could
collapse, or I could be in respiratory failure and then I _would_ be disabled. This is compounded by the fact that I look entirely able bodied, I act as if nothing
is wrong, I travel, and outside of being a bit skinny, no one would ever know if I told them.

Part of having my lung function drop so hard has been a recognition that I am disabled, I need more sleep, more help around the house, and a lot of my socially
or task avoidant behaviors were actually me just saving energy. By resting more, being more kind to myself, and not acting like a temporarily-disabled abled-body person, then I do myself a lot more good

### It is Better to be Lonely Than to be With Someone Hurtful



