# Adapter Development Guide

Adapters should only fill fields after a user-triggered scan and review step. Platform-specific adapters can override detection and scanning, but should return the same serializable `FormFieldNode` and `FillPlan` types used by the generic adapter.

For MVP, Greenhouse, SmartRecruiters, Personio, Workday, TalentScout/custom, and LinkedIn are registered as stubs. LinkedIn remains copy-assist only.
