# ADR-0011: MSG91 (SMS/OTP) + WhatsApp Business API + Exotel (IVR) + Amazon SES (email)

- **Status:** Accepted
- **Date:** 2026-07-14
- **Sprint:** Sprint 0 (T01)

## Context
Module 6 (Notification Engine) must reach SHG members and buyers over SMS, WhatsApp, voice/IVR alerts and email — for OTP login, buyer enquiries, demand/price changes and tender opportunities — with DLT-compliant SMS as required for Indian telecom regulation.

## Decision
Use MSG91 (or Gupshup) with DLT-registered templates for SMS (also powering OTP), WhatsApp Business API for templated conversational messages, Exotel for IVR voice alerts with TTS, and Amazon SES for email — all behind a single provider-abstraction layer in the Notification Service so channels can be swapped later.

## Alternatives Considered
- **Twilio for all channels** — simpler single-vendor integration, but weaker India DLT/SMS compliance tooling and typically higher cost for Indian SMS/voice than India-first providers.
- **Build a custom SMPP/SMS gateway integration** — more control, but unnecessary integration risk for a 90-day pilot when DLT-compliant providers already exist off the shelf.

## Consequences
- Positive: DLT compliance for SMS/OTP out of the box; India-first providers (MSG91, Exotel) reduce latency/cost/compliance risk; the provider-abstraction layer keeps each channel swappable without touching domain-event logic.
- Trade-offs: four distinct provider integrations (T13) to build, test and monitor delivery/retry logic for within one sprint.
