import type { Meta, StoryObj } from "@storybook/react-vite";
import { useState } from "react";
import { Dialog, Button } from "../src/primitives/index.js";

const meta: Meta<typeof Dialog> = {
  title: "Desygn UI/Dialog",
  component: Dialog,
};
export default meta;

type Story = StoryObj<typeof Dialog>;

/** Interactive: open the dialog, Tab is trapped, Escape / backdrop closes. */
export const Default: Story = {
  render: () => {
    const [open, setOpen] = useState(false);
    return (
      <>
        <Button onClick={() => setOpen(true)}>Open dialog</Button>
        <Dialog
          open={open}
          onClose={() => setOpen(false)}
          title="Delete this audit?"
          footer={
            <>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Cancel
              </Button>
              <Button variant="danger" onClick={() => setOpen(false)}>
                Delete
              </Button>
            </>
          }
        >
          <p>This permanently removes the audit run and its report. This cannot be undone.</p>
        </Dialog>
      </>
    );
  },
};
