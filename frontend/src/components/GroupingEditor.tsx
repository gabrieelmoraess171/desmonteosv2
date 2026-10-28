import { useState, type DragEvent } from 'react';
import {
  Check,
  CheckSquare,
  Grid,
  Link,
  Pencil,
  Square,
  Star,
  Trash2,
  Unlink,
  X,
} from 'lucide-react';

export interface ProductGroupImage {
  id: string;
  preview: string;
  fileName: string;
  detectedAsSKU?: boolean;
}

export interface ProductGroup {
  id: string;
  sku: string;
  name?: string;
  images: ProductGroupImage[];
  suggestedName?: string;
  confidence: 'high' | 'medium' | 'low';
  alerts: string[];
}

interface GroupingEditorProps {
  groups: ProductGroup[];
  onGroupUpdate: (groups: ProductGroup[]) => void;
}

const CONFIDENCE_LABELS = {
  high: 'Alta',
  medium: 'Média',
  low: 'Baixa',
} as const;

function createGroupId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `new-${crypto.randomUUID()}`;
  }

  return `new-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function uniqueSku(baseSku: string, groups: ProductGroup[]): string {
  const used = new Set(groups.map((group) => group.sku.toUpperCase()));
  let candidate = `${baseSku}-SPLIT`;
  let suffix = 2;

  while (used.has(candidate.toUpperCase())) {
    candidate = `${baseSku}-SPLIT-${suffix}`;
    suffix += 1;
  }

  return candidate;
}

function withAlert(alerts: string[], alert: string): string[] {
  return alerts.includes(alert) ? alerts : [...alerts, alert];
}

export default function GroupingEditor({
  groups,
  onGroupUpdate,
}: GroupingEditorProps) {
  const [draggedImage, setDraggedImage] = useState<{
    groupId: string;
    imageId: string;
  } | null>(null);
  const [dragOverGroupId, setDragOverGroupId] = useState<string | null>(null);
  const [selectedGroups, setSelectedGroups] = useState<string[]>([]);
  const [editingSKU, setEditingSKU] = useState<string | null>(null);
  const [newSKUName, setNewSKUName] = useState('');
  const [skuError, setSkuError] = useState('');

  const totalImages = groups.reduce(
    (total, group) => total + group.images.length,
    0
  );

  const handleDragStart = (
    event: DragEvent<HTMLDivElement>,
    groupId: string,
    imageId: string
  ) => {
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', imageId);
    setDraggedImage({ groupId, imageId });
  };

  const handleDragOver = (
    event: DragEvent<HTMLDivElement>,
    groupId: string
  ) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDragOverGroupId(groupId);
  };

  const handleDragEnd = () => {
    setDraggedImage(null);
    setDragOverGroupId(null);
  };

  const handleDrop = (
    event: DragEvent<HTMLDivElement>,
    targetGroupId: string
  ) => {
    event.preventDefault();
    event.stopPropagation();
    setDragOverGroupId(null);

    if (!draggedImage) return;

    const { groupId: sourceGroupId, imageId } = draggedImage;
    setDraggedImage(null);

    if (sourceGroupId === targetGroupId) return;

    const sourceGroup = groups.find((group) => group.id === sourceGroupId);
    const image = sourceGroup?.images.find((item) => item.id === imageId);

    if (!image) return;

    const remainingSourceImages =
      sourceGroup?.images.filter((item) => item.id !== imageId) ?? [];

    const updatedGroups = groups
      .filter(
        (group) =>
          !(group.id === sourceGroupId && remainingSourceImages.length === 0)
      )
      .map((group) => {
        if (group.id === sourceGroupId) {
          return { ...group, images: remainingSourceImages };
        }

        if (group.id === targetGroupId) {
          return {
            ...group,
            images: [...group.images, image],
          };
        }

        return group;
      });

    if (remainingSourceImages.length === 0) {
      setSelectedGroups((previous) =>
        previous.filter((id) => id !== sourceGroupId)
      );
    }

    onGroupUpdate(updatedGroups);
  };

  const handleSplitGroup = (groupId: string) => {
    const group = groups.find((item) => item.id === groupId);
    if (!group || group.images.length < 2) return;

    const image = group.images[group.images.length - 1];
    const newGroup: ProductGroup = {
      id: createGroupId(),
      sku: uniqueSku(group.sku, groups),
      images: [image],
      confidence: 'low',
      alerts: ['Grupo dividido manualmente'],
    };

    const updatedGroups = groups.map((item) =>
      item.id === groupId
        ? {
            ...item,
            images: item.images.slice(0, -1),
            alerts: withAlert(item.alerts, 'Grupo dividido manualmente'),
          }
        : item
    );

    onGroupUpdate([...updatedGroups, newGroup]);
  };

  const handleMergeGroups = () => {
    if (selectedGroups.length < 2) return;

    const selectedSet = new Set(selectedGroups);
    const groupsToMerge = groups.filter((group) => selectedSet.has(group.id));
    const primaryGroup = groupsToMerge[0];

    if (!primaryGroup) return;

    const mergedImages = groupsToMerge.flatMap((group) => group.images);
    const otherGroupsCount = groupsToMerge.length - 1;

    const updatedGroups = groups
      .filter(
        (group) => !selectedSet.has(group.id) || group.id === primaryGroup.id
      )
      .map((group) =>
        group.id === primaryGroup.id
          ? {
              ...group,
              images: mergedImages,
              confidence: 'low' as const,
              alerts: withAlert(
                group.alerts,
                `${otherGroupsCount} grupo(s) mesclado(s); confirme o SKU`
              ),
            }
          : group
      );

    setSelectedGroups([]);
    onGroupUpdate(updatedGroups);
  };

  const handleDeleteImage = (groupId: string, imageId: string) => {
    const group = groups.find((item) => item.id === groupId);
    if (!group) return;

    const remainingImages = group.images.filter((image) => image.id !== imageId);

    if (remainingImages.length === 0) {
      const updatedGroups = groups.filter((item) => item.id !== groupId);
      setSelectedGroups((previous) =>
        previous.filter((id) => id !== groupId)
      );
      onGroupUpdate(updatedGroups);
      return;
    }

    onGroupUpdate(
      groups.map((item) =>
        item.id === groupId ? { ...item, images: remainingImages } : item
      )
    );
  };

  const handleSetPrincipal = (groupId: string, imageId: string) => {
    const group = groups.find((item) => item.id === groupId);
    if (!group) return;

    const image = group.images.find((item) => item.id === imageId);
    if (!image) return;

    const reordered = [
      image,
      ...group.images.filter((item) => item.id !== imageId),
    ];

    onGroupUpdate(
      groups.map((item) =>
        item.id === groupId ? { ...item, images: reordered } : item
      )
    );
  };

  const handleStartEditSKU = (group: ProductGroup) => {
    setEditingSKU(group.id);
    setNewSKUName(group.sku);
    setSkuError('');
  };

  const handleCancelEditSKU = () => {
    setEditingSKU(null);
    setNewSKUName('');
    setSkuError('');
  };

  const handleUpdateSKU = (groupId: string) => {
    const sku = newSKUName.trim();

    if (!sku) {
      setSkuError('Informe um SKU');
      return;
    }

    const duplicated = groups.some(
      (group) =>
        group.id !== groupId && group.sku.toUpperCase() === sku.toUpperCase()
    );

    if (duplicated) {
      setSkuError('Este SKU já está em outro grupo');
      return;
    }

    onGroupUpdate(
      groups.map((group) => {
        if (group.id !== groupId) return group;

        const autoName = `Produto ${group.sku}`;
        const shouldUpdateName = !group.name || group.name === autoName;

        return {
          ...group,
          sku,
          name: shouldUpdateName ? `Produto ${sku}` : group.name,
          alerts: withAlert(group.alerts, 'SKU alterado manualmente'),
        };
      })
    );

    handleCancelEditSKU();
  };

  const toggleGroupSelection = (groupId: string) => {
    setSelectedGroups((previous) =>
      previous.includes(groupId)
        ? previous.filter((id) => id !== groupId)
        : [...previous, groupId]
    );
  };

  return (
    <div className="space-y-6">
      <div className="bg-card border border-border rounded-xl p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <Grid className="h-4 w-4 text-text-secondary" />
              <span className="text-text-primary font-medium">
                {groups.length} grupos • {totalImages} fotos
              </span>
            </div>

            <button
              type="button"
              onClick={handleMergeGroups}
              disabled={selectedGroups.length < 2}
              className={`px-3 py-1 rounded flex items-center gap-1 ${
                selectedGroups.length >= 2
                  ? 'bg-accent text-white hover:brightness-110'
                  : 'bg-border text-text-secondary cursor-not-allowed'
              }`}
            >
              <Link className="h-3 w-3" />
              <span>Mesclar ({selectedGroups.length})</span>
            </button>
          </div>

          <div className="text-sm text-text-secondary">
            Arraste fotos entre grupos para reorganizar
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
        {groups.map((group) => {
          const isSelected = selectedGroups.includes(group.id);
          const isDragTarget = dragOverGroupId === group.id;

          return (
            <div
              key={group.id}
              className={`bg-card border rounded-xl p-4 transition-colors ${
                isDragTarget
                  ? 'border-accent bg-accent/5'
                  : isSelected
                  ? 'border-accent ring-2 ring-accent/20'
                  : 'border-border'
              }`}
              onDragOver={(event) => handleDragOver(event, group.id)}
              onDragLeave={(event) => {
                if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                  setDragOverGroupId((current) =>
                    current === group.id ? null : current
                  );
                }
              }}
              onDrop={(event) => handleDrop(event, group.id)}
            >
              <div className="flex items-start justify-between gap-3 mb-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-2 min-h-8">
                    {editingSKU === group.id ? (
                      <div className="flex flex-wrap items-center gap-2">
                        <input
                          type="text"
                          value={newSKUName}
                          onChange={(event) => {
                            setNewSKUName(event.target.value);
                            setSkuError('');
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') handleUpdateSKU(group.id);
                            if (event.key === 'Escape') handleCancelEditSKU();
                          }}
                          autoFocus
                          aria-label={`Novo SKU para o grupo ${group.sku}`}
                          className="bg-primary border border-border rounded px-2 py-1 text-sm text-text-primary focus:outline-none focus:ring-2 focus:ring-accent"
                          placeholder="Novo SKU"
                        />
                        <button
                          type="button"
                          onClick={() => handleUpdateSKU(group.id)}
                          aria-label="Salvar SKU"
                          title="Salvar SKU"
                          className="p-1 bg-success text-white rounded"
                        >
                          <Check className="h-3 w-3" />
                        </button>
                        <button
                          type="button"
                          onClick={handleCancelEditSKU}
                          aria-label="Cancelar edição de SKU"
                          title="Cancelar"
                          className="p-1 bg-border rounded"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <h3 className="font-bold text-lg truncate" title={group.sku}>
                          {group.sku}
                        </h3>
                        <button
                          type="button"
                          onClick={() => handleStartEditSKU(group)}
                          aria-label={`Editar SKU ${group.sku}`}
                          title="Editar SKU"
                          className="p-1 text-text-secondary hover:text-text-primary"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                      </>
                    )}
                  </div>

                  {editingSKU === group.id && skuError && (
                    <p className="text-xs text-danger mb-2" role="alert">
                      {skuError}
                    </p>
                  )}

                  {group.suggestedName && (
                    <p className="text-sm text-text-secondary mb-2">
                      {group.suggestedName}
                    </p>
                  )}

                  <div className="flex flex-wrap items-center gap-3">
                    <span
                      className={`px-2 py-1 rounded text-xs font-medium ${
                        group.confidence === 'high'
                          ? 'bg-success/20 text-success'
                          : group.confidence === 'medium'
                          ? 'bg-warning/20 text-warning'
                          : 'bg-danger/20 text-danger'
                      }`}
                    >
                      Confiança: {CONFIDENCE_LABELS[group.confidence]}
                    </span>

                    <span className="text-text-secondary text-sm">
                      {group.images.length} foto
                      {group.images.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => toggleGroupSelection(group.id)}
                    aria-pressed={isSelected}
                    aria-label={
                      isSelected
                        ? `Desmarcar grupo ${group.sku} para mesclagem`
                        : `Selecionar grupo ${group.sku} para mesclagem`
                    }
                    title={
                      isSelected
                        ? 'Remover da seleção de mesclagem'
                        : 'Selecionar para mesclagem'
                    }
                    className={`p-2 rounded ${
                      isSelected
                        ? 'bg-accent text-white'
                        : 'hover:bg-secondary text-text-secondary'
                    }`}
                  >
                    {isSelected ? (
                      <CheckSquare className="h-4 w-4" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </button>

                  <button
                    type="button"
                    onClick={() => handleSplitGroup(group.id)}
                    disabled={group.images.length < 2}
                    aria-label={`Dividir grupo ${group.sku}`}
                    title="Separar a última foto em um novo grupo"
                    className={`p-2 rounded hover:bg-secondary ${
                      group.images.length < 2
                        ? 'opacity-50 cursor-not-allowed'
                        : ''
                    }`}
                  >
                    <Unlink className="h-4 w-4" />
                  </button>
                </div>
              </div>

              {group.alerts.length > 0 && (
                <div className="mb-4 space-y-1">
                  {group.alerts.map((alert, index) => (
                    <div
                      key={`${alert}-${index}`}
                      className="text-xs text-warning bg-warning/10 px-2 py-1 rounded"
                    >
                      ⚠️ {alert}
                    </div>
                  ))}
                </div>
              )}

              {group.images.length > 0 ? (
                <div className="grid grid-cols-3 gap-2">
                  {group.images.map((image, index) => (
                    <div
                      key={image.id}
                      className="relative aspect-square bg-primary rounded overflow-hidden group focus-within:ring-2 focus-within:ring-accent"
                      draggable
                      onDragStart={(event) =>
                        handleDragStart(event, group.id, image.id)
                      }
                      onDragEnd={handleDragEnd}
                      title="Arraste para outro grupo"
                    >
                      <img
                        src={image.preview}
                        alt={image.fileName}
                        loading="lazy"
                        className="w-full h-full object-cover"
                      />

                      <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 transition-opacity flex items-center justify-center gap-2">
                        {index > 0 && (
                          <button
                            type="button"
                            onClick={() => handleSetPrincipal(group.id, image.id)}
                            aria-label={`Definir ${image.fileName} como foto principal`}
                            title="Definir como foto principal"
                            className="p-1 bg-card rounded hover:bg-secondary"
                          >
                            <Star className="h-3 w-3" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteImage(group.id, image.id)}
                          aria-label={`Remover ${image.fileName}`}
                          title="Remover foto"
                          className="p-1 bg-danger rounded hover:brightness-110"
                        >
                          <Trash2 className="h-3 w-3" />
                        </button>
                      </div>

                      {index === 0 && (
                        <div className="absolute top-2 left-2">
                          <span className="px-1.5 py-0.5 bg-accent text-white text-[10px] font-bold rounded">
                            CAPA
                          </span>
                        </div>
                      )}

                      {image.detectedAsSKU && (
                        <div className="absolute top-2 right-2">
                          <span className="px-1.5 py-0.5 bg-success text-white text-[10px] font-bold rounded">
                            TAG
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-text-secondary">
                  Nenhuma foto neste grupo.
                </p>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
