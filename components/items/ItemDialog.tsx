"use client";

import { useState } from "react";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import ItemForm, {
  ProductFormValues,
} from "./ItemForm";

import { createItem } from "@/repositories/item.repository";
import type { Item } from "@/types/item";

type Props = {
  onCreated: (item: Item) => void;
};

export default function ItemDialog({
  onCreated,
}: Props) {
  const [open, setOpen] = useState(false);

  async function handleCreate(values: ProductFormValues) {
    try {
      const data = await createItem(values);

      if (data && data.length > 0) {
        onCreated(data[0] as Item);
      }

      setOpen(false);
    } catch (error) {
      console.error(error);
      alert("حدث خطأ أثناء إضافة الصنف");
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger>
        <span className="cursor-pointer rounded-lg bg-blue-600 px-5 py-3 font-semibold hover:bg-blue-700">
          ➕ إضافة صنف
        </span>
      </DialogTrigger>

      <DialogContent className="max-w-xl border-zinc-800 bg-zinc-900 text-white">
        <DialogHeader>
          <DialogTitle>
            إضافة صنف جديد
          </DialogTitle>
        </DialogHeader>

        <ItemForm onSubmit={handleCreate} />
      </DialogContent>
    </Dialog>
  );
}