import { v4 as uuidv4 } from 'uuid';
import { UserRow } from '../db/queries/userQueries.js';
import { conversationQueries } from '../db/queries/conversationQueries.js';
import { CalendarService, MacroPivotChange, MacroPivotResult } from './calendar.service.js';

export type PreferenceChangeSource = 'PREFERENCES_FORM' | 'AGENT';

const FIELD_LABELS: Record<MacroPivotChange['field'], string> = {
  major: 'major',
  standing: 'standing',
  targetTerm: 'target term',
  targetCredits: 'target credits',
};

export function describePivotChanges(changes: MacroPivotChange[]): string {
  return changes
    .map((c) => `${FIELD_LABELS[c.field]} ${c.from ?? 'unset'} → ${c.to ?? 'unset'}`)
    .join('; ');
}

/**
 * Builds the notice stored in conversation history so the agent (and the user) can see that
 * the schedule was reset by a preference change made outside the chat, or by an agent tool.
 */
export function buildPivotNotice(result: MacroPivotResult, source: PreferenceChangeSource): string {
  const origin = source === 'AGENT' ? 'via SlugAgent' : 'from Edit Preferences';
  const pinned = result.clearedPinnedCourses ? ' (including pinned courses)' : '';
  const next = result.requiresAgentRegeneration
    ? 'A new schedule needs to be built for these preferences.'
    : 'A fresh baseline schedule was generated for these preferences.';
  return (
    `Preferences updated ${origin}: ${describePivotChanges(result.changes)}. ` +
    `The previous schedule${pinned} was cleared. ${next}`
  );
}

export class PreferenceSyncService {
  /**
   * Single entry point for every preference/profile change, whether it comes from the
   * Edit Preferences form or from an agent tool call. Runs macro-pivot detection, and when the
   * schedule is reset because something actually changed, records a SYSTEM message in the
   * conversation so the agent's next turn has that context.
   */
  static applyChange(
    userId: string,
    user: UserRow,
    newMajor: string | undefined,
    newStanding: string | undefined,
    newPrefs: any,
    source: PreferenceChangeSource
  ): MacroPivotResult {
    const result = CalendarService.handleMacroHardPivot(
      userId,
      user,
      newMajor,
      newStanding,
      newPrefs
    );

    if (result.isMacroPivot && result.changes.length > 0) {
      conversationQueries.insertMessage({
        message_id: uuidv4(),
        user_id: userId,
        sender: 'SYSTEM',
        content: buildPivotNotice(result, source),
        tool_calls: null,
        metadata: JSON.stringify({ kind: 'PREFERENCE_PIVOT', source, changes: result.changes }),
      });
    }

    return result;
  }
}
