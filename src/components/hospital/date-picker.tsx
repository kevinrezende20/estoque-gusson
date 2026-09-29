import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { CalendarIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { cn } from "@/lib/utils";

type DatePickerProps = {
  value: Date | undefined;
  onChange: (date?: Date) => void;
  label: string;
};

export function DatePicker({ value, onChange, label }: DatePickerProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          className={cn("h-11 w-full justify-start rounded-xl bg-card text-left font-normal", !value && "text-muted-foreground")}
        >
          <CalendarIcon />
          {value ? format(value, "dd/MM/yyyy") : <span>Selecionar data</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar
          mode="single"
          selected={value}
          onSelect={onChange}
          locale={ptBR}
          initialFocus
          className="pointer-events-auto p-3"
          aria-label={label}
        />
      </PopoverContent>
    </Popover>
  );
}
