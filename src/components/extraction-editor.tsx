import { useId } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { newExtractionRule } from "@/lib/extraction";
import { cn } from "@/lib/utils";
import { type ExtractionMode, type ExtractionRule, MAX_EXTRACTIONS } from "@/types";

interface ExtractionEditorProps {
  rules: ExtractionRule[];
  disabled: boolean;
  onChange: (rules: ExtractionRule[]) => void;
}

interface RuleRowProps {
  rule: ExtractionRule;
  index: number;
  disabled: boolean;
  onChange: (rule: ExtractionRule) => void;
  onRemove: () => void;
}

function RuleRow({ rule, index, disabled, onChange, onRemove }: RuleRowProps) {
  const id = useId();
  const title = rule.name.trim() || `Extraction ${index + 1}`;
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
            placeholder={`Extraction ${index + 1}`}
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
        <Label htmlFor={`${id}-selector`} className="text-xs">
          CSS selector
        </Label>
        <Input
          id={`${id}-selector`}
          className="h-8 font-mono text-xs"
          placeholder=".price"
          spellCheck={false}
          autoCapitalize="off"
          autoCorrect="off"
          value={rule.selector}
          disabled={disabled}
          onChange={(e) => onChange({ ...rule, selector: e.target.value })}
        />
      </div>
      <div className="flex flex-wrap items-end gap-x-4 gap-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor={`${id}-mode`} className="text-xs">
            Extract
          </Label>
          <select
            id={`${id}-mode`}
            className={cn(
              "h-8 rounded-md border border-input bg-transparent px-2 text-xs shadow-xs outline-none",
              "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 disabled:opacity-50",
              "dark:bg-input/30",
            )}
            value={rule.mode}
            disabled={disabled}
            onChange={(e) => onChange({ ...rule, mode: e.target.value as ExtractionMode })}
          >
            <option value="text">Text</option>
            <option value="attr">Attribute</option>
            <option value="inner_html">Inner HTML</option>
          </select>
        </div>
        {rule.mode === "attr" && (
          <div className="flex flex-1 flex-col gap-1">
            <Label htmlFor={`${id}-attr`} className="text-xs">
              Attribute
            </Label>
            <Input
              id={`${id}-attr`}
              className="h-8 font-mono text-xs"
              placeholder="content"
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
              value={rule.attr ?? ""}
              disabled={disabled}
              onChange={(e) => onChange({ ...rule, attr: e.target.value })}
            />
          </div>
        )}
      </div>
    </fieldset>
  );
}

/** Screaming Frog style custom extraction rules: each collects values matched by a CSS selector. */
export function ExtractionEditor({ rules, disabled, onChange }: ExtractionEditorProps) {
  const full = rules.length >= MAX_EXTRACTIONS;
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-sm font-medium">Custom extraction</span>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={disabled || full}
          onClick={() => onChange([...rules, newExtractionRule()])}
        >
          <Plus />
          Add extraction
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        Collects the text, an attribute or the inner HTML of the elements a CSS selector matches on every HTML
        page, shown as a column in Pages and in the CSV export. Up to {MAX_EXTRACTIONS} extractions, 10 values
        each.
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
