import { useId } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { newCustomSearchRule } from "@/lib/customSearch";
import { cn } from "@/lib/utils";
import { type CustomSearchRule, type CustomSearchScope, MAX_CUSTOM_SEARCHES } from "@/types";

interface CustomSearchEditorProps {
  rules: CustomSearchRule[];
  disabled: boolean;
  onChange: (rules: CustomSearchRule[]) => void;
}

interface RuleRowProps {
  rule: CustomSearchRule;
  index: number;
  disabled: boolean;
  onChange: (rule: CustomSearchRule) => void;
  onRemove: () => void;
}

function RuleRow({ rule, index, disabled, onChange, onRemove }: RuleRowProps) {
  const id = useId();
  const title = rule.name.trim() || `Search ${index + 1}`;
  return (
    <fieldset className="flex flex-col gap-2 rounded-md border p-2.5">
      <legend className="sr-only">{title}</legend>
      <div className="flex items-end gap-2">
        <div className="flex flex-1 flex-col gap-1">
          <Label htmlFor={`${id}-name`} className="text-xs">
            Name
          </Label>
          <Input
            id={`${id}-name`}
            className="h-8"
            placeholder={`Search ${index + 1}`}
            value={rule.name}
            disabled={disabled}
            onChange={(e) => onChange({ ...rule, name: e.target.value })}
          />
        </div>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8"
          aria-label={`Remove ${title}`}
          disabled={disabled}
          onClick={onRemove}
        >
          <Trash2 />
        </Button>
      </div>
      <div className="flex flex-col gap-1">
        <Label htmlFor={`${id}-pattern`} className="text-xs">
          {rule.isRegex ? "Regular expression" : "Text"}
        </Label>
        <Input
          id={`${id}-pattern`}
          className="h-8 font-mono text-xs"
          placeholder={rule.isRegex ? String.raw`SKU-\d+` : "Out of stock"}
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          value={rule.pattern}
          disabled={disabled}
          onChange={(e) => onChange({ ...rule, pattern: e.target.value })}
        />
      </div>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <label className="flex items-center gap-2 text-xs">
          <Checkbox
            checked={rule.isRegex}
            disabled={disabled}
            onCheckedChange={(checked) => onChange({ ...rule, isRegex: checked === true })}
          />
          Regex
        </label>
        <div className="flex items-center gap-2">
          <Label htmlFor={`${id}-scope`} className="text-xs">
            Search in
          </Label>
          <select
            id={`${id}-scope`}
            className={cn(
              "h-8 rounded-md border border-input bg-transparent px-2 text-xs shadow-xs outline-none",
              "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50",
              "dark:bg-input/30",
            )}
            value={rule.scope}
            disabled={disabled}
            onChange={(e) => onChange({ ...rule, scope: e.target.value as CustomSearchScope })}
          >
            <option value="html">HTML source</option>
            <option value="text">Visible text</option>
          </select>
        </div>
      </div>
    </fieldset>
  );
}

/** Screaming Frog style custom search rules: each counts matches of a text or regex per page. */
export function CustomSearchEditor({ rules, disabled, onChange }: CustomSearchEditorProps) {
  const full = rules.length >= MAX_CUSTOM_SEARCHES;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">Custom search</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || full}
          onClick={() => onChange([...rules, newCustomSearchRule()])}
        >
          <Plus />
          Add search
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Counts matches on every HTML page, so you can filter pages that contain or do not contain it. Text is
        matched case-insensitively; a regex is matched as written. Up to {MAX_CUSTOM_SEARCHES} searches.
      </p>
      {rules.map((rule, index) => (
        <RuleRow
          key={rule.id}
          rule={rule}
          index={index}
          disabled={disabled}
          onChange={(next) => onChange(rules.map((r) => (r.id === rule.id ? next : r)))}
          onRemove={() => onChange(rules.filter((r) => r.id !== rule.id))}
        />
      ))}
    </div>
  );
}
