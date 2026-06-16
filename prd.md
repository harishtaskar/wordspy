# Product Requirements Document (PRD)

# Secret Word Agent

Version: 1.0 MVP
Platform: Web (Mobile + Desktop)
Game Type: Multiplayer Social Deduction Party Game

---

# 1. Product Vision

Secret Word Agent is a fast-paced social deduction game where players receive a secret word, except for one player who becomes the Imposter.

The Crew must identify and vote out the Imposter through discussion and observation.

The Imposter must blend in, gather clues, and survive until the end of the game.

A complete match should take 3–5 minutes, making it easy to replay multiple times with friends.

---

# 2. Problem Statement

Most party games require:

* Long setup times
* Complex rules
* Downloads and installations

Secret Word Agent aims to provide:

* Instant room creation
* Simple rules
* Fast rounds
* Browser-based gameplay
* High replayability

---

# 3. Target Audience

Primary:

* Friends playing online
* Discord communities
* College students
* Casual gamers

Secondary:

* Streamers
* Team-building groups
* Family game nights

Age Range:
13+

---

# 4. Core Gameplay

Each game contains:

1. Role Assignment
2. Discussion Round 1
3. Vote Round 1
4. Discussion Round 2
5. Vote Round 2
6. Winner Reveal

---

# 5. Roles

## Crew Member

Receives:

* Secret word

Goal:

* Identify the Imposter

---

## Imposter

Receives:

* Imposter role only
* No secret word

Goal:

* Avoid detection
* Learn the word
* Survive until the end

---

# 6. Match Flow

## Step 1: Lobby

Host creates room.

Players join using:

* Room code
* Share link

Host settings:

* Category
* Discussion time
* Max players

Host starts game.

---

## Step 2: Role Assignment

Crew sees:

Word: Pizza

Imposter sees:

Role: Imposter

Find the secret word and survive.

---

## Step 3: Discussion Round 1

Duration:
60–120 seconds

Players discuss the word without saying it directly.

Examples:

Word = Pizza

Player A:
"Best when shared."

Player B:
"Usually arrives in a box."

Player C:
"Popular on weekends."

Imposter attempts to blend in.

---

## Step 4: Voting Round 1

Players vote anonymously.

Most voted player becomes the suspect.

---

## Step 5: Result

### If suspect is Imposter

Game ends.

Crew wins.

### If suspect is Crew

Round 2 begins.

---

## Step 6: Discussion Round 2

Remaining players continue discussion.

Imposter has additional clues.

Players become more aggressive with questioning.

---

## Step 7: Voting Round 2

Final vote.

Most voted player is revealed.

---

# 7. Win Conditions

## Crew Victory

Crew successfully votes out the Imposter in Round 1 or Round 2.

---

## Imposter Victory

Imposter survives both voting rounds.

---

# 8. Final Guess Mechanic

If the Imposter is voted out:

The Imposter receives one final action.

Prompt:

"What is the secret word?"

If correct:

* Imposter steals victory

If incorrect:

* Crew wins

Purpose:

* Creates dramatic endings
* Rewards good deduction

---

# 9. Categories

MVP Categories:

* Food
* Movies
* Animals
* Countries
* Sports
* Technology
* Random

Future Categories:

* Memes
* Internet Culture
* Anime
* Gaming
* Custom Packs

---

# 10. Scoring System

## Crew

Correct vote:
+100

Survive round:
+20

Win match:
+150

---

## Imposter

Survive Round 1:
+100

Survive Round 2:
+200

Correct final guess:
+300

Win match:
+250

---

# 11. Room Settings

Host can configure:

* Public / Private
* Player limit
* Discussion timer
* Number of Imposters (future)
* Category selection
* Custom word packs (future)

---

# 12. User Stories

## Player

As a player,
I want to join quickly,
So that I can start playing without creating an account.

---

## Crew

As a Crew member,
I want to receive a secret word,
So that I can identify suspicious players.

---

## Imposter

As an Imposter,
I want to gather clues from discussion,
So that I can discover the hidden word.

---

## Host

As a host,
I want to control room settings,
So that I can customize gameplay.

---

# 13. MVP Features

## Must Have

* Create room
* Join room
* Random word assignment
* Imposter assignment
* Discussion timer
* Anonymous voting
* Vote result screen
* Winner screen
* Mobile responsive UI

---

## Nice To Have

* Sound effects
* Avatars
* Leaderboard
* Match history
* Reconnect support

---

# 14. Future Features

## Ranked Mode

Seasonal ranking system.

---

## Voice Rooms

Built-in voice chat.

---

## Multiple Imposters

For larger rooms.

---

## AI Word Generation

Unlimited word packs.

---

## Streamer Mode

Audience participation.

---

## Spectator Mode

Watch games without joining.

---

# 15. Technical Requirements

Frontend:

* Next.js
* React
* Tailwind CSS

Backend:

* Node.js
* Socket.IO

Database:

* PostgreSQL

Hosting:

* Vercel (Frontend)
* Railway / Render (Backend)

Real-Time Requirements:

* Room synchronization
* Voting updates
* Timer synchronization
* Role distribution

---

# 16. Success Metrics

Launch Goals:

* Average game duration < 5 minutes
* Room creation < 10 seconds
* 80% match completion rate
* 50% players start another match
* Mobile usability score > 90%

---

# 17. Open Questions & Clarifications

Before development begins, these decisions need answers:

1. What is the minimum and maximum player count?
2. Should voting ties trigger a re-vote or eliminate nobody?
3. Can players vote for themselves?
4. Can players skip voting?
5. Should the Imposter know the category?
6. Should dead/eliminated players continue watching discussion?
7. Should usernames be editable during a match?
8. Should discussion be text chat, voice chat, or both?
9. Should rooms persist if the host disconnects?
10. Should there be a profanity filter for usernames?
11. Should the final word guess be timed?
12. Should players see vote counts after each round?
13. Should there be one Imposter only in MVP?
14. How are words selected and balanced?
15. What happens if a player disconnects during voting?
16. Should friends be able to rematch instantly?
17. Is account creation required or optional?
18. Will public matchmaking exist in MVP?
19. Should the game support custom categories?
20. How should scoring affect future rankings and progression?
