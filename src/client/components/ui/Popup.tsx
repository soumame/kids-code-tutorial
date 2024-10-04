import * as Dialog from "@radix-ui/react-dialog";
import * as VisuallyHidden from "@radix-ui/react-visually-hidden";

import { X } from "lucide-react";
import React from "react";

export default function Popup(props: {
	openState: boolean;
	onClose: () => void;
	Content: JSX.Element;
}) {
	const showPopup = props.openState;

	return (
		showPopup && (
			<Dialog.Root open={showPopup} onOpenChange={props.onClose}>
				<Dialog.Overlay className="fixed w-full h-full inset-0 z-[997] bg-gray-200/10 backdrop-blur-md p-2">
					<VisuallyHidden.Root>
						<Dialog.Title>Popup</Dialog.Title>
						<Dialog.Description>Popup contents</Dialog.Description>
					</VisuallyHidden.Root>

					<Dialog.Content asChild>
						<div className="fixed flex flex-col max-w-3xl w-full max-h-[80vh] gap-3 bg-white rounded-2xl p-5 top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 z-[998] font-semibold overflow-y-auto">
							{props.Content}
						</div>
					</Dialog.Content>
					<Dialog.Close asChild>
						<span className="fixed top-4 right-4 p-2 bg-gray-200 rounded-full z-[999]">
							<X />
						</span>
					</Dialog.Close>
				</Dialog.Overlay>
			</Dialog.Root>
		)
	);
}
