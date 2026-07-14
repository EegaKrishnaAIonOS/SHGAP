# ADR-0005: Redis + BullMQ for cache, sessions and async jobs

- **Status:** Accepted
- **Date:** 2026-07-14
- **Sprint:** Sprint 0 (T01)

## Context
The platform needs: fast session/JWT-adjacent state, voice-dialogue multi-turn context, response caching (analytics, TTS), and reliable background job processing with retries (notification fan-out to SMS/WhatsApp/IVR/email).

## Decision
Use Redis as the shared cache/session/dialogue-state store, and BullMQ (Redis-backed) as the job queue for the Notification Service, giving one piece of infrastructure for both needs.

## Alternatives Considered
- **RabbitMQ/Kafka for queueing** — better durability/throughput guarantees at scale, but heavier to operate for a 90-day pilot than a Redis queue already needed for caching/sessions.
- **In-memory session state per service instance** — removes a dependency, but breaks horizontally-scaled pods and loses voice-dialogue continuity across requests.

## Consequences
- Positive: single Redis deployment serves sessions, cache and queue; BullMQ gives retries/backoff/delivery-log hooks needed for notification reliability (T13) with minimal setup.
- Trade-offs: Redis is a single additional stateful dependency to make highly-available and to include in the DPDP encryption/audit scope (T22).
