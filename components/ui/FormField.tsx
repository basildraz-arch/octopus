import { ReactNode } from "react";

type Props = {
  label: string;
  required?: boolean;
  children: ReactNode;
};

export default function FormField({
  label,
  required,
  children,
}: Props) {
  return (
    <div className="space-y-2">

      <label className="block text-sm font-medium text-zinc-300">

        {label}

        {required && (
          <span className="ml-1 text-red-500">*</span>
        )}

      </label>

      {children}

    </div>
  );
}