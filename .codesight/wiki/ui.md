# UI

> **Navigation aid.** Component inventory and prop signatures extracted via AST. Read the source files before adding props or modifying component logic.

**80 components** (react)

## Components

- **ColorPicker** — props: value, onChange — `web/src/components/custom/color-picker.tsx`
- **EntityTable** — props: entityTypes — `web/src/components/entity-table/components/entity-table.tsx`
- **NotFound** — `web/src/components/not-found.tsx`
- **PDFContainerClient** — props: initalDocuments, allEntityTypes, author, exportName, canRotate — `web/src/components/pdf-container/pdf-container-client.tsx`
- **PDFContainer** — props: initalDocuments, allEntityTypes, author, canRotate — `web/src/components/pdf-container/pdf-container.tsx`
- **PDFLoading** — `web/src/components/pdf-container/pdf-loading.tsx`
- **AnnotationContainer** — props: documentId, scale, rotation, annotation, isSelected, onDoubleClick, onSelect, selectionOutline, style — `web/src/components/pdf-container/plugin-annotation-2/components/annotation-container/annotation-container.tsx`
- **CounterRotate** — props: rect, rotation — `web/src/components/pdf-container/plugin-annotation-2/components/annotation-container/counter-rotate.tsx`
- **SelectedMenu** — props: documentId, annotation, selected, rect, menuWrapperProps — `web/src/components/pdf-container/plugin-annotation-2/components/annotation-container/selected-menu.tsx`
- **AnnotationLayer** — props: documentId, pageIndex, scale, rotation, selectionOutline, style — `web/src/components/pdf-container/plugin-annotation-2/components/annotation-layer.tsx`
- **Annotations** — props: documentId, pageIndex, scale, rotation, selectionOutline — `web/src/components/pdf-container/plugin-annotation-2/components/annotations.tsx`
- **Highlight** — props: color, opacity, segmentRects, rect, scale, onClick, style — `web/src/components/pdf-container/plugin-annotation-2/components/text-markup/highlight.tsx`
- **TextMarkupPreview** — props: documentId, pageIndex, scale — `web/src/components/pdf-container/plugin-annotation-2/components/text-markup/preview.tsx`
- **Squiggly** — props: color, opacity, segmentRects, rect, scale, onClick, style — `web/src/components/pdf-container/plugin-annotation-2/components/text-markup/squiggly.tsx`
- **Strikeout** — props: color, opacity, segmentRects, rect, scale, onClick, style — `web/src/components/pdf-container/plugin-annotation-2/components/text-markup/strikeout.tsx`
- **Underline** — props: color, opacity, segmentRects, rect, scale, onClick, style — `web/src/components/pdf-container/plugin-annotation-2/components/text-markup/underline.tsx`
- **DocumentContent** — props: documentState, isLoading, isError, isLoaded — `web/src/components/pdf-container/plugin-document-manager-2/components/document-content.tsx`
- **DocumentContext** — props: documentStates, activeDocumentId, actions — `web/src/components/pdf-container/plugin-document-manager-2/components/document-context.tsx`
- **FilePicker** — `web/src/components/pdf-container/plugin-document-manager-2/components/file-picker.tsx`
- **Download** — `web/src/components/pdf-container/plugin-export-2/components/download.tsx`
- **GlobalPointerProvider** — props: documentId, style — `web/src/components/pdf-container/plugin-interaction-manager-2/components/global-pointer-provider.tsx`
- **PagePointerProvider** — props: documentId, pageIndex, rotation, scale, convertEventToPoint, style — `web/src/components/pdf-container/plugin-interaction-manager-2/components/page-pointer-provider.tsx`
- **RenderLayer** — props: documentId, pageIndex, scale, dpr, style — `web/src/components/pdf-container/plugin-render-2/components/render-layer.tsx`
- **Rotate** — props: documentId, pageIndex, rotation, scale, style — `web/src/components/pdf-container/plugin-rotate-2/components/rotate.tsx`
- **Scroller** — props: documentId, renderPage — `web/src/components/pdf-container/plugin-scroll-2/components/scroller.tsx`
- **SearchLayer** — props: documentId, pageIndex, scale, style, highlightColor, activeHighlightColor — `web/src/components/pdf-container/plugin-search-2/components/search-layer.tsx`
- **CopyToClipboard** — `web/src/components/pdf-container/plugin-selection-2/components/copy-to-clipboard.tsx`
- **MarqueeSelection** — props: documentId, pageIndex, scale, className, background, borderColor, borderStyle, stroke, fill — `web/src/components/pdf-container/plugin-selection-2/components/marquee-selection.tsx`
- **SelectionLayer** — props: documentId, pageIndex, scale, background, textStyle, marqueeStyle, marqueeClassName — `web/src/components/pdf-container/plugin-selection-2/components/selection-layer.tsx`
- **TextSelection** — props: documentId, pageIndex, scale, background — `web/src/components/pdf-container/plugin-selection-2/components/text-selection.tsx`
- **ThumbImg** — props: documentId, meta, style — `web/src/components/pdf-container/plugin-thumbnail-2/components/thumbnail-img.tsx`
- **ThumbnailsPane** — props: documentId, style — `web/src/components/pdf-container/plugin-thumbnail-2/components/thumbnails-pane.tsx`
- **TileImg** — props: documentId, pageIndex, tile, dpr, scale — `web/src/components/pdf-container/plugin-tiling-2/components/tile-img.tsx`
- **TilingLayer** — props: documentId, pageIndex, scale, style — `web/src/components/pdf-container/plugin-tiling-2/components/tiling-layer.tsx`
- **Viewport** — props: documentId — `web/src/components/pdf-container/plugin-viewport-2/components/viewport.tsx`
- **ZoomGestureWrapper** — props: documentId, style, enablePinch, enableWheel — `web/src/components/pdf-container/plugin-zoom-2/components/zoom-gesture-wrapper.tsx`
- **RotateWrapper** — props: enabled, documentId, pageIndex, style — `web/src/components/pdf-container/rotate-wrapper.tsx`
- **Toolbar** — props: canRotate, isSidebarOpen, setIsSidebarOpen — `web/src/components/pdf-container/toolbar/index.tsx`
- **Toolbar** — props: canRotate, isSidebarOpen, setIsSidebarOpen — `web/src/components/pdf-container/toolbar/toolbar-dev.tsx`
- **ToolbarToggleButton** — props: isSidebarOpen, setIsSidebarOpen — `web/src/components/pdf-container/toolbar/toolbar-toggle-button.tsx`
- **PluginStoreTable** — `web/src/components/plugin-store/components/dev/plugin-store-table.tsx`
- **ProjectTabs** — props: projectId, currentStep, variant — `web/src/components/project-tabs.tsx`
- **Chatbot** — `web/src/components/public-site/chatbot.tsx`
- **Footer** — `web/src/components/public-site/footer.tsx`
- **Header** — `web/src/components/public-site/header.tsx`
- **ButtonGroup** — props: className, orientation — `web/src/components/shadcn-ui/button-group.tsx`
- **Empty** — props: className — `web/src/components/shadcn-ui/empty.tsx`
- **FieldSet** — props: className — `web/src/components/shadcn-ui/field.tsx`
- **InputGroup** — props: className — `web/src/components/shadcn-ui/input-group.tsx`
- **ItemGroup** — props: className — `web/src/components/shadcn-ui/item.tsx`
- **Kbd** — props: className — `web/src/components/shadcn-ui/kbd.tsx`
- **Spinner** — props: className — `web/src/components/shadcn-ui/spinner.tsx`
- **ContactAutoReply** — props: name — `web/src/emails/contact-auto-reply.tsx`
- **ContactNotification** — props: name, email, message — `web/src/emails/contact-notification.tsx`
- **OrganizationInvitation** — props: invitedByName, organizationName, url — `web/src/emails/organization-invitation.tsx`
- **ResetPassword** — props: name, url — `web/src/emails/reset-password.tsx`
- **VerifyEmail** — props: name, url — `web/src/emails/verify-email.tsx`
- **Provider** — props: queryClient — `web/src/integrations/tanstack-query/root-provider.tsx`
- **Route** — `web/src/routes/__root.tsx`
- **Route** — `web/src/routes/_auth/signin.tsx`
- **Route** — `web/src/routes/_auth/signout.tsx`
- **Route** — `web/src/routes/_auth/signup.tsx`
- **Route** — `web/src/routes/_auth.tsx`
- **Route** — `web/src/routes/_private/billing.tsx`
- **Route** — `web/src/routes/_private/profile.tsx`
- **Route** — `web/src/routes/_private/projects/$projectId.tsx`
- **Route** — `web/src/routes/_private/projects/$projectId_.checking.tsx`
- **Route** — `web/src/routes/_private/projects/$projectId_.dashboard.tsx`
- **Route** — `web/src/routes/_private/projects/$projectId_.documents.tsx`
- **Route** — `web/src/routes/_private/projects/$projectId_.engineering.tsx`
- **Route** — `web/src/routes/_private/projects/$projectId_.entity_types.tsx`
- **Route** — `web/src/routes/_private/projects/$projectId_.labelling.tsx`
- **Route** — `web/src/routes/_private/projects/index.tsx`
- **Route** — `web/src/routes/_private.tsx`
- **Route** — `web/src/routes/_public/about.tsx`
- **Route** — `web/src/routes/_public/contact.tsx`
- **Route** — `web/src/routes/_public/demo.tsx`
- **Route** — `web/src/routes/_public/index.tsx`
- **Route** — `web/src/routes/_public/pricing.tsx`
- **Route** — `web/src/routes/_public.tsx`

---
_Back to [overview.md](./overview.md)_