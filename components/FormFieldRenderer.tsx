import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FormField, FormItem, FormLabel, FormControl, FormMessage, FormDescription } from "@/components/ui/form";
import { Control } from "react-hook-form";
import type { FieldConfig as GenericFieldConfig } from "@/types/forms";

export type FieldConfig = GenericFieldConfig;

interface FormFieldRendererProps {
    fieldConfig: FieldConfig;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    control: Control<any>;
}

export function FormFieldRenderer({ fieldConfig, control }: FormFieldRendererProps) {
    return (
        <FormField
            control={control}
            name={fieldConfig.id}
            render={({ field }) => (
                <FormItem className="space-y-2">
                    <FormLabel className="font-semibold text-foreground text-sm flex items-center justify-between">
                        <span>
                            {fieldConfig.label}
                            {fieldConfig.required && <span className="text-destructive ml-1">*</span>}
                        </span>
                    </FormLabel>
                    
                    {fieldConfig.helpText && (
                        <FormDescription className="text-xs text-muted-foreground">
                            {fieldConfig.helpText}
                        </FormDescription>
                    )}

                    <FormControl>
                        {(() => {
                            switch (fieldConfig.type) {
                                case "text":
                                case "email":
                                case "phone":
                                case "url":
                                case "number":
                                    return (
                                        <Input
                                            type={fieldConfig.type === "number" ? "number" : fieldConfig.type === "email" ? "email" : fieldConfig.type === "phone" ? "tel" : fieldConfig.type === "url" ? "url" : "text"}
                                            placeholder={fieldConfig.placeholder || ""}
                                            {...field}
                                            value={field.value ?? ""}
                                            className="h-12 rounded-xl bg-muted/20 border-border px-4 text-base"
                                        />
                                    );

                                case "long_text":
                                    return (
                                        <Textarea
                                            placeholder={fieldConfig.placeholder || ""}
                                            {...field}
                                            value={field.value ?? ""}
                                            className="min-h-[100px] rounded-xl bg-muted/20 border-border p-4 text-base resize-y"
                                        />
                                    );

                                case "dropdown":
                                    return (
                                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                                            <SelectTrigger className="h-12 rounded-xl bg-muted/20 border-border px-4 text-base">
                                                <SelectValue placeholder={fieldConfig.placeholder || "Pilih salah satu..."} />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {fieldConfig.options?.map((opt, idx) => (
                                                    <SelectItem key={idx} value={opt.value}>
                                                        {opt.label}
                                                    </SelectItem>
                                                ))}
                                            </SelectContent>
                                        </Select>
                                    );

                                case "radio":
                                    return (
                                        <RadioGroup
                                            onValueChange={field.onChange}
                                            defaultValue={field.value}
                                            className="flex flex-col space-y-2 pt-1"
                                        >
                                            {fieldConfig.options?.map((opt, idx) => (
                                                <div key={idx} className="flex items-center space-x-3 p-3 rounded-xl border border-border/60 bg-muted/10 hover:bg-muted/20 transition-colors cursor-pointer">
                                                    <RadioGroupItem value={opt.value} id={`${fieldConfig.id}-${idx}`} />
                                                    <label htmlFor={`${fieldConfig.id}-${idx}`} className="text-sm font-medium cursor-pointer flex-1">
                                                        {opt.label}
                                                    </label>
                                                </div>
                                            ))}
                                        </RadioGroup>
                                    );

                                case "checkbox":
                                    return (
                                        <div className="flex flex-col space-y-2 pt-1">
                                            {fieldConfig.options?.map((opt, idx) => {
                                                const currentValues = Array.isArray(field.value) ? field.value : [];
                                                return (
                                                    <div key={idx} className="flex items-center space-x-3 p-3 rounded-xl border border-border/60 bg-muted/10 hover:bg-muted/20 transition-colors cursor-pointer">
                                                        <Checkbox
                                                            id={`${fieldConfig.id}-${idx}`}
                                                            checked={currentValues.includes(opt.value)}
                                                            onCheckedChange={(checked) => {
                                                                if (checked) {
                                                                    field.onChange([...currentValues, opt.value]);
                                                                } else {
                                                                    field.onChange(currentValues.filter((v: string) => v !== opt.value));
                                                                }
                                                            }}
                                                        />
                                                        <label htmlFor={`${fieldConfig.id}-${idx}`} className="text-sm font-medium cursor-pointer flex-1">
                                                            {opt.label}
                                                        </label>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    );

                                case "date":
                                    return (
                                        <Input
                                            type="date"
                                            {...field}
                                            value={field.value ?? ""}
                                            className="h-12 rounded-xl bg-muted/20 border-border px-4 text-base"
                                        />
                                    );

                                case "file_upload":
                                    return (
                                        <div className="space-y-2">
                                            <Input
                                                type="file"
                                                onChange={(e) => {
                                                    const file = e.target.files?.[0];
                                                    if (file) field.onChange(file);
                                                }}
                                                className="h-12 rounded-xl bg-muted/20 border-border px-4 text-base file:mr-4 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-semibold file:bg-primary file:text-primary-foreground hover:file:bg-primary/90"
                                            />
                                        </div>
                                    );

                                default:
                                    return (
                                        <Input
                                            placeholder={fieldConfig.placeholder || ""}
                                            {...field}
                                            value={field.value ?? ""}
                                            className="h-12 rounded-xl bg-muted/20 border-border px-4 text-base"
                                        />
                                    );
                            }
                        })()}
                    </FormControl>
                    <FormMessage />
                </FormItem>
            )}
        />
    );
}
