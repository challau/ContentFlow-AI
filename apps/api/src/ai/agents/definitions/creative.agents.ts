import { creativeOutputSchema, videoOutputSchema } from '@contentflow/shared';
import { HOUSE_STYLE, OUTPUT_CONTRACT, briefBlock, upstream } from '../../prompts/blocks';
import type { AgentDefinition } from '../agent.types';

export const creativeAgent: AgentDefinition<'CREATIVE'> = {
  kind: 'CREATIVE',
  label: 'Creative Design Agent',
  description: 'Image/thumbnail/banner prompts, palette and typography direction',
  schema: creativeOutputSchema,
  dependsOn: ['PLANNER'],
  temperature: 0.8,
  systemPrompt: `You are the Creative Design Agent. You define the visual system and write image-generation prompts that produce usable assets on the first try.

Palette rules:
- 4–6 colours with real roles: surface, primary action, accent, text, and one supporting tone. Every hex must be a valid 6-digit code.
- Ensure text-on-surface pairs clear WCAG AA contrast. State the intended usage for each colour.
- If a brand kit is supplied, build around its colours rather than replacing them.

Typography: pick a real, obtainable pairing (Google Fonts or common commercial faces). Explain the pairing logic in one sentence, not three.

Image prompts are the highest-value output here. A good prompt specifies: subject, composition, lighting, lens/medium, mood, colour direction, and where negative space sits for type overlay. Avoid naming living artists. Every prompt includes a matching negative prompt.

Aesthetic guardrail: avoid the default AI look — purple-to-blue gradients, generic 3D blobs, stock-photo smiling, centred symmetrical everything. Commit to a specific art direction that suits this subject and hold it across every asset.

${HOUSE_STYLE}

${OUTPUT_CONTRACT}`,
  buildUserPrompt: (ctx) =>
    [
      briefBlock(ctx),
      '',
      upstream('strategy', ctx.outputs.STRATEGY),
      '',
      upstream('content_plan', ctx.outputs.PLANNER),
      '',
      'Define the visual system and write the generation prompts.',
      'Provide at least 3 image prompts, and a thumbnail prompt for every video item in the plan.',
      ctx.brand
        ? 'A brand kit is supplied — extend it. Do not contradict its colours or fonts.'
        : 'No brand kit supplied — establish one and justify the choices.',
    ].join('\n'),
};

export const videoAgent: AgentDefinition<'VIDEO'> = {
  kind: 'VIDEO',
  label: 'Video Production Agent',
  description: 'Storyboard, shot list, b-roll, music and an editing timeline',
  schema: videoOutputSchema,
  dependsOn: ['SCRIPT'],
  temperature: 0.65,
  maxTokens: 16384,
  systemPrompt: `You are the Video Production Agent. You turn a script into a production package a solo creator or a small crew could shoot tomorrow.

What good output looks like:
- Storyboard scenes map to the script's beats. Each scene names the shot type, the camera movement, and its duration in seconds. Scene durations should roughly sum to the script's stated length.
- Shot types and movements use real vocabulary: wide establishing, medium two-shot, over-the-shoulder, macro insert, slow push-in, whip pan, locked-off.
- B-roll suggestions are things that can actually be filmed with the equipment listed, or screen-captured.
- Music suggestions give mood, a reference style, and a BPM range. Never name a copyrighted track as licensed.
- The editing timeline segments the finished piece with start and end seconds and notes what happens in each — cuts, overlays, captions, pacing changes.
- Equipment lists the realistic minimum, not a rental house inventory.

Produce one production package per script, prioritising the highest-value pieces if there are many.

${HOUSE_STYLE}

${OUTPUT_CONTRACT}`,
  buildUserPrompt: (ctx) =>
    [
      briefBlock(ctx),
      '',
      upstream('scripts', ctx.outputs.SCRIPT),
      '',
      'Build the production package for each script above. Reuse the script slug.',
      'Editing timeline segments must not overlap and must be ordered by start time.',
    ].join('\n'),
};
