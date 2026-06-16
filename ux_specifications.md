# Secret Word Agent

# Architecture & UX Specification

Version 1.0 (MVP)

---

# 1. Product Overview

Secret Word Agent is a real-time multiplayer social deduction game.

Players join a room.

Everyone receives the same secret word except one Imposter.

The Crew discusses the word and attempts to identify the Imposter.

The Imposter attempts to infer the word and survive voting.

Game Duration:
3–5 minutes

Platform:
Web-first (Mobile + Desktop)

---

# 2. User Journey

## First-Time User

Landing Page
→ Enter Username
→ Create Room OR Join Room
→ Lobby
→ Game
→ Results
→ Play Again

Target Time To Fun:
< 20 seconds

No account required.

---

# 3. Information Architecture

Home
├── Create Room
├── Join Room
├── How To Play
└── Settings

Room
├── Lobby
├── Role Reveal
├── Discussion Round
├── Voting Round
├── Results
└── Rematch

---

# 4. Screen Specifications

## Screen 1: Landing Page

Purpose:
Instant entry.

Components:

Logo

Game Name

Username Input

Buttons:

* Create Room
* Join Room

Secondary:

* How To Play

Footer:

* Privacy
* Terms

---

## Screen 2: Create Room

Inputs:

Nickname

Room Settings:

Category

Discussion Time:

* 60s
* 90s
* 120s

Max Players:

* 4
* 6
* 8
* 10

Create Room

Output:

Room Code

Example:

ABCD12

---

## Screen 3: Join Room

Inputs:

Nickname

Room Code

Button:
Join

Validation:

* Room exists
* Room active
* Room not full

---

## Screen 4: Lobby

Shows:

Room Code

Player List

Host Badge

Player Count

Ready Status

Chat (Optional)

Host Controls:

Start Game

Leave Room

Kick Player

---

## Screen 5: Role Reveal

Full Screen Modal

Crew:

YOUR WORD

PIZZA

Imposter:

YOU ARE THE IMPOSTER

Find the word.

Timer:
5 seconds

Continue

---

## Screen 6: Discussion Round

Layout:

Top:
Round Number

Timer

Center:
Discussion Feed

Bottom:
Message Input

Player List Sidebar

Status Indicators:

Alive

Disconnected

Speaking

Voting Pending

Discussion Ends Automatically

---

## Screen 7: Voting Round

Title:
Who is the Imposter?

Player Cards

Select One Player

Submit Vote

Rules:

One vote only

Cannot change vote after submit

Anonymous

---

## Screen 8: Vote Reveal

Animation

Shows:

Who received most votes

Role Reveal

Cases:

Crew Eliminated

Imposter Eliminated

Tie

---

## Screen 9: Final Guess

Only appears when Imposter is caught.

Input:

Guess The Word

Submit

Results:

Correct
→ Imposter Wins

Wrong
→ Crew Wins

---

## Screen 10: Match Results

Winner Banner

Scoreboard

Player Scores

Secret Word Reveal

Buttons:

Play Again

Leave Room

---

# 5. UX Principles

## Mobile First

70%+ users expected on mobile.

Large touch targets.

Single-column layouts.

---

## Minimal Cognitive Load

Never show more than:

* One primary action
* One timer
* One objective

At any moment.

---

## Fast Feedback

Every action should respond in:

< 100ms

Examples:

Vote submitted

Joined room

Ready status

---

## Visible Progress

Always show:

Round

Time Remaining

Players Remaining

---

# 6. Frontend Architecture

Framework:

Next.js

State:

Zustand

Real-Time:

Socket.IO Client

UI:

Tailwind CSS

Deployment:

Vercel

Structure:

src/
├ pages/
├ components/
├ hooks/
├ stores/
├ services/
├ types/
└ utils/

---

# 7. Backend Architecture

Framework:

Node.js

Express

Socket.IO Server

Deployment:

Railway

Structure:

server/
├ sockets/
├ rooms/
├ game/
├ services/
├ database/
└ utils/

---

# 8. System Architecture

Browser
↓
Socket.IO
↓
Game Server
↓
PostgreSQL

Realtime Events

Player Actions
→ Socket

Game State
→ Socket

Persistence
→ PostgreSQL

---

# 9. Game State Machine

LOBBY

↓

ROLE_REVEAL

↓

DISCUSSION_ROUND_1

↓

VOTING_ROUND_1

↓

RESULT_1

↓

DISCUSSION_ROUND_2

↓

VOTING_ROUND_2

↓

RESULT_2

↓

FINAL_GUESS

↓

GAME_END

---

# 10. Socket Events

Client → Server

create_room

join_room

leave_room

start_game

send_message

submit_vote

submit_guess

play_again

heartbeat

---

Server → Client

room_created

player_joined

player_left

game_started

role_assigned

discussion_started

vote_started

vote_result

final_guess_started

game_finished

error

---

# 11. Database Schema

Users

id

nickname

created_at

---

Rooms

id

room_code

host_id

status

created_at

---

Players

id

room_id

user_id

score

role

connected

---

Games

id

room_id

secret_word

winner

started_at

ended_at

---

Votes

id

game_id

voter_id

target_id

round

---

# 12. Word System

Storage:

words

id

word

category

difficulty

enabled

Examples:

Pizza

Volcano

Laptop

Tiger

Football

Paris

Word Selection:

Random

No repeats in same room session

---

# 13. Security

Server authoritative state

No client-side role storage

No secret words exposed in API

Validate all socket payloads

Rate limit chat messages

Prevent duplicate votes

Prevent multiple room joins

---

# 14. Edge Cases

Host disconnects

→ Transfer host

---

Player disconnects during game

→ Mark disconnected

Allow reconnect

---

Voting tie

→ No elimination

Proceed to next round

---

Imposter disconnects

→ End match

Crew wins

---

Room empty

→ Auto-delete room

---

# 15. Performance Targets

Join Room:
< 1 second

Vote Sync:
< 300ms

Room Capacity:
50 concurrent rooms

Players Per Room:
10

Server Tick:
100ms

---

# 16. Analytics Events

room_created

room_joined

game_started

vote_submitted

imposter_caught

imposter_won

match_completed

rematch_started

These events will drive retention and balancing decisions.

---

# 17. Open Questions & Clarifications

Gameplay

1. Should ties eliminate nobody or trigger a re-vote?
2. Should players be able to skip votes?
3. Should self-voting be allowed?
4. Should the Imposter know the category?
5. Should there be more than one Imposter in future versions?

UX

6. Should discussion be text only, voice only, or hybrid?
7. Should spectators be allowed?
8. Should dead players chat?
9. Should users need accounts?
10. Should public matchmaking exist?

Technical

11. How long should rooms persist?
12. Should reconnection restore the exact state?
13. Should game history be stored?
14. What is the maximum room size?
15. Should private rooms support invite links?

Business

16. Will monetization exist?
17. Will custom word packs be paid?
18. Will ranked mode exist?
19. Will ads be shown?
20. What is the primary growth channel: friends, Discord, or streamers?
