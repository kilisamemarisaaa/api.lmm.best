/*
Copyright (C) 2026 LIghtJUNction

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as
published by the Free Software Foundation, either version 3 of the
License, or (at your option) any later version.
*/
import assert from 'node:assert/strict'
import { test } from 'node:test'

import { Window } from 'happy-dom'

import type { BountyProject } from './types'

test('mounted bounty date reacts to language changes without remounting', async () => {
  const window = new Window()
  const globals = [
    'window',
    'document',
    'navigator',
    'HTMLElement',
    'Node',
    'IS_REACT_ACT_ENVIRONMENT',
  ] as const
  const descriptors = new Map(
    globals.map((key) => [
      key,
      Object.getOwnPropertyDescriptor(globalThis, key),
    ])
  )
  for (const key of globals) {
    Object.defineProperty(globalThis, key, {
      configurable: true,
      value: key === 'IS_REACT_ACT_ENVIRONMENT' ? true : window[key],
    })
  }
  const { act } = await import('react')
  const { createRoot } = await import('react-dom/client')
  const { createInstance } = await import('i18next')
  const { I18nextProvider, initReactI18next } = await import('react-i18next')
  const { BountyDecision } = await import('./bounty-decision')
  const container = document.createElement('div')
  document.body.append(container)
  const root = createRoot(container)
  try {
    const i18n = createInstance()
    await i18n.use(initReactI18next).init({
      lng: 'en',
      fallbackLng: false,
      resources: {},
      interpolation: { escapeValue: false },
    })
    const updatedAt = 1_790_050_000
    const project = {
      reward_slots: 3,
      active_challenge_count: 1,
      approved_challenge_count: 1,
      owner_rating_count: 0,
      updated_at: updatedAt,
    } as BountyProject
    await act(async () => {
      root.render(
        <I18nextProvider i18n={i18n}>
          <BountyDecision project={project} compact />
        </I18nextProvider>
      )
    })
    const dateNode = container.querySelectorAll('dd')[3]
    assert.ok(dateNode)
    for (const [language, locale] of [
      ['fr', 'fr'],
      ['zhCN', 'zh-CN'],
      ['zhTW', 'zh-TW'],
      ['invalid_locale', undefined],
      ['en', 'en'],
    ] as const) {
      await act(async () => {
        await i18n.changeLanguage(language)
      })
      assert.equal(container.querySelectorAll('dd')[3], dateNode)
      assert.equal(
        dateNode.textContent,
        new Date(updatedAt * 1000).toLocaleDateString(locale)
      )
    }
  } finally {
    await act(async () => root.unmount())
    window.close()
    for (const key of globals) {
      const descriptor = descriptors.get(key)
      if (descriptor) Object.defineProperty(globalThis, key, descriptor)
      else Reflect.deleteProperty(globalThis, key)
    }
  }
})
