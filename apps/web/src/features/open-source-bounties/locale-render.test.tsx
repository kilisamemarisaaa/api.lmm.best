/*
Copyright (C) 2026 LIghtJUNction

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { createInstance } from 'i18next'
import { renderToStaticMarkup } from 'react-dom/server'
import { I18nextProvider, initReactI18next } from 'react-i18next'

import { INTERFACE_LANGUAGE_OPTIONS, toIntlLocale } from '@/i18n/languages'

import { BountyDecision } from './bounty-decision'
import { BountyProgress } from './bounty-progress'
import type { BountyChallenge, BountyProject } from './types'

const updatedAt = 1_790_050_000
const project = {
  reward_slots: 3,
  active_challenge_count: 1,
  approved_challenge_count: 1,
  owner_rating_count: 0,
  updated_at: updatedAt,
  owner_username: 'fixture-owner',
  escrow_quota: 0,
} as BountyProject
const challenge = {
  status: 'submitted',
  accepted_at: updatedAt - 60,
  submitted_at: updatedAt,
  issue_url: 'https://github.com/example/project/issues/1',
  pull_request_url: 'https://github.com/example/project/pull/2',
} as BountyChallenge

for (const { code } of INTERFACE_LANGUAGE_OPTIONS) {
  test(`bounty cards and delivery dates render in ${code} without the 500 boundary`, async () => {
    const i18n = createInstance()
    await i18n.use(initReactI18next).init({
      lng: code,
      resources: { [code]: { translation: {} } },
      interpolation: { escapeValue: false },
    })
    const render = (content: React.ReactNode) =>
      renderToStaticMarkup(
        <I18nextProvider i18n={i18n}>{content}</I18nextProvider>
      )
    const card = render(<BountyDecision project={project} compact />)
    const timeline = render(<BountyProgress challenge={challenge} />)
    assert.ok(
      card.includes(
        new Date(updatedAt * 1000).toLocaleDateString(toIntlLocale(code))
      )
    )
    assert.ok(timeline.includes(new Date(updatedAt * 1000).toISOString()))
    const evidenceLinks = Array.from(
      timeline.matchAll(/href="([^"]*)"/g),
      ([, href]) => href
    )
    assert.deepEqual(evidenceLinks, [
      challenge.issue_url,
      challenge.pull_request_url,
    ])
    assert.equal((timeline.match(/<time /g) ?? []).length, 2)
  })
}

for (const compact of [false, true]) {
  test(`bounty date fallback and resolved language work with compact=${compact}`, async () => {
    const i18n = createInstance()
    await i18n.use(initReactI18next).init({
      lng: 'de-DE',
      fallbackLng: 'fr',
      resources: { fr: { translation: { Updated: 'Updated' } } },
      interpolation: { escapeValue: false },
    })
    assert.equal(i18n.language, 'de-DE')
    assert.equal(i18n.resolvedLanguage, 'fr')
    const render = (updated_at: number) =>
      renderToStaticMarkup(
        <I18nextProvider i18n={i18n}>
          <BountyDecision
            project={{ ...project, updated_at }}
            compact={compact}
          />
        </I18nextProvider>
      )
    const expected = new Date(updatedAt * 1000).toLocaleDateString('fr')
    const html = render(updatedAt)
    assert.ok(html.includes(`<dd>${expected}</dd>`))
    assert.equal(
      html.includes('Reviewed by the publisher: fixture-owner'),
      !compact
    )
    for (const unknown of [0, -1, Number.NaN]) {
      assert.ok(render(unknown).includes('<dd>Unknown</dd>'))
    }
    await i18n.init({
      lng: 'invalid_locale',
      fallbackLng: false,
      resources: {},
    })
    assert.equal(i18n.resolvedLanguage, undefined)
    assert.ok(
      render(updatedAt).includes(
        `<dd>${new Date(updatedAt * 1000).toLocaleDateString()}</dd>`
      )
    )
  })
}
