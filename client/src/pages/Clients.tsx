import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { trpc } from "@/lib/trpc";
import {
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  File,
  FileSpreadsheet,
  FileText,
  Film,
  Folder,
  FolderOpen,
  Image,
  Loader2,
  Music,
  Search,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type Client = { id: string; name: string; path: string; driveUrl: string };
type DriveFile = {
  id: string;
  name: string;
  isDir: boolean;
  mimeType: string;
  size: number;
  icon: string;
  driveUrl: string;
  path: string;
};

const ICON_MAP: Record<string, React.ReactNode> = {
  folder: <Folder className="h-4 w-4 text-[oklch(0.45_0.22_27)]" />,
  doc: <FileText className="h-4 w-4 text-blue-500" />,
  sheet: <FileSpreadsheet className="h-4 w-4 text-green-600" />,
  slides: <File className="h-4 w-4 text-orange-500" />,
  pdf: <FileText className="h-4 w-4 text-red-500" />,
  image: <Image className="h-4 w-4 text-purple-500" />,
  video: <Film className="h-4 w-4 text-pink-500" />,
  audio: <Music className="h-4 w-4 text-indigo-500" />,
  file: <File className="h-4 w-4 text-gray-400" />,
};

function formatSize(bytes: number): string {
  if (!bytes || bytes <= 0) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function Clients() {
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [subfolder, setSubfolder] = useState<string | undefined>(undefined);
  const [breadcrumbs, setBreadcrumbs] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [clientFilter, setClientFilter] = useState("");

  const { data: clients = [], isLoading: loadingClients } = trpc.drive.listClients.useQuery();

  const { data: files = [], isLoading: loadingFiles } = trpc.drive.listClientFiles.useQuery(
    { clientName: selectedClient?.name ?? "", subfolder },
    { enabled: !!selectedClient }
  );

  const { data: searchResults, isLoading: loadingSearch } = trpc.drive.search.useQuery(
    { query: search },
    { enabled: search.length >= 2 }
  );

  const filteredClients = clients.filter((c) =>
    c.name.toLowerCase().includes(clientFilter.toLowerCase())
  );

  const handleClientClick = (client: Client) => {
    setSelectedClient(client);
    setSubfolder(undefined);
    setBreadcrumbs([]);
    setSearch("");
    setSearchInput("");
  };

  const handleFolderClick = (file: DriveFile) => {
    const newPath = subfolder ? `${subfolder}/${file.name}` : file.name;
    setSubfolder(newPath);
    setBreadcrumbs((prev) => [...prev, file.name]);
  };

  const handleBreadcrumb = (index: number) => {
    if (index < 0) {
      setSubfolder(undefined);
      setBreadcrumbs([]);
    } else {
      const newBreadcrumbs = breadcrumbs.slice(0, index + 1);
      setBreadcrumbs(newBreadcrumbs);
      setSubfolder(newBreadcrumbs.join("/"));
    }
  };

  const handleSearch = () => {
    if (searchInput.trim().length < 2) {
      toast.info("Digite pelo menos 2 caracteres para buscar");
      return;
    }
    setSearch(searchInput.trim());
    setSelectedClient(null);
  };

  return (
    <DashboardLayout>
      <div className="flex flex-col h-full">
        {/* Header */}
        <div className="px-6 md:px-10 pt-8 pb-6 border-b-2 border-black shrink-0">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <p className="text-xs font-semibold tracking-widest uppercase text-[oklch(0.45_0.22_27)] mb-1">
                Google Drive
              </p>
              <h1 className="text-4xl font-black tracking-tight text-black">Clientes</h1>
            </div>
            {/* Global search */}
            <div className="flex gap-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
                <Input
                  placeholder="Buscar clientes e documentos..."
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") handleSearch(); }}
                  className="pl-8 h-9 text-sm w-64 border-black"
                />
              </div>
              <Button
                onClick={handleSearch}
                disabled={loadingSearch}
                className="h-9 bg-black text-white hover:bg-[oklch(0.45_0.22_27)] text-xs font-bold uppercase tracking-wide"
              >
                {loadingSearch ? <Loader2 className="h-4 w-4 animate-spin" /> : "Buscar"}
              </Button>
              {search && (
                <Button
                  variant="outline"
                  onClick={() => { setSearch(""); setSearchInput(""); }}
                  className="h-9 border-black text-xs"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left panel: client list */}
          <div className="w-64 shrink-0 border-r-2 border-black flex flex-col overflow-hidden">
            <div className="p-3 border-b border-black">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3 w-3 text-gray-400" />
                <Input
                  placeholder="Filtrar clientes..."
                  value={clientFilter}
                  onChange={(e) => setClientFilter(e.target.value)}
                  className="pl-7 h-8 text-xs border-gray-300"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {loadingClients ? (
                <div className="flex justify-center py-8">
                  <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
                </div>
              ) : filteredClients.length === 0 ? (
                <div className="p-4 text-xs text-gray-400 text-center">Nenhum cliente encontrado</div>
              ) : (
                filteredClients.map((client) => {
                  const isActive = selectedClient?.id === client.id;
                  return (
                    <button
                      key={client.id}
                      onClick={() => handleClientClick(client)}
                      className={`w-full text-left px-3 py-2.5 flex items-center gap-2.5 border-b border-gray-100 transition-colors ${
                        isActive
                          ? "bg-[oklch(0.45_0.22_27)] text-white"
                          : "hover:bg-gray-50 text-gray-700"
                      }`}
                    >
                      <Folder className={`h-3.5 w-3.5 shrink-0 ${isActive ? "text-white" : "text-[oklch(0.45_0.22_27)]"}`} />
                      <span className="text-xs font-medium truncate">{client.name}</span>
                    </button>
                  );
                })
              )}
            </div>
            <div className="p-3 border-t border-black">
              <p className="text-xs text-gray-400 text-center">
                {filteredClients.length} cliente{filteredClients.length !== 1 ? "s" : ""}
              </p>
            </div>
          </div>

          {/* Right panel: file browser or search results */}
          <div className="flex-1 overflow-y-auto">
            {/* Search results */}
            {search && (
              <div className="p-6">
                <div className="mb-6">
                  <p className="text-xs font-semibold tracking-widest uppercase text-gray-500 mb-1">
                    Resultados para
                  </p>
                  <h2 className="text-2xl font-black tracking-tight">"{search}"</h2>
                  {searchResults && (
                    <p className="text-xs text-gray-400 mt-1">{searchResults.total} resultado{searchResults.total !== 1 ? "s" : ""} encontrado{searchResults.total !== 1 ? "s" : ""}</p>
                  )}
                </div>

                {loadingSearch ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
                  </div>
                ) : !searchResults || searchResults.total === 0 ? (
                  <div className="border-2 border-dashed border-gray-200 p-12 text-center">
                    <Search className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-sm text-gray-400">Nenhum resultado encontrado</p>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* Client matches */}
                    {searchResults.clients.length > 0 && (
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest mb-3 border-b border-black pb-2">
                          Clientes ({searchResults.clients.length})
                        </p>
                        <div className="space-y-1">
                          {searchResults.clients.map((c) => (
                            <SearchResultRow
                              key={c.id}
                              icon={<Folder className="h-4 w-4 text-[oklch(0.45_0.22_27)]" />}
                              name={c.name}
                              subtitle="Pasta de cliente"
                              driveUrl={c.driveUrl}
                              onOpen={() => handleClientClick(c as Client)}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                    {/* File matches */}
                    {searchResults.files.length > 0 && (
                      <div>
                        <p className="text-xs font-black uppercase tracking-widest mb-3 border-b border-black pb-2">
                          Documentos ({searchResults.files.length})
                        </p>
                        <div className="space-y-1">
                          {searchResults.files.map((f) => (
                            <SearchResultRow
                              key={f.id}
                              icon={ICON_MAP[f.icon] ?? ICON_MAP.file}
                              name={f.name}
                              subtitle={`Em: ${f.clientName}`}
                              driveUrl={f.driveUrl}
                            />
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {/* File browser */}
            {!search && selectedClient && (
              <div className="p-6">
                {/* Client header */}
                <div className="mb-6 flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <FolderOpen className="h-5 w-5 text-[oklch(0.45_0.22_27)]" />
                      <h2 className="text-2xl font-black tracking-tight">{selectedClient.name}</h2>
                    </div>
                    {/* Breadcrumbs */}
                    <div className="flex items-center gap-1 text-xs text-gray-500 flex-wrap">
                      <button
                        onClick={() => handleBreadcrumb(-1)}
                        className="hover:text-black font-medium transition-colors"
                      >
                        Raiz
                      </button>
                      {breadcrumbs.map((crumb, i) => (
                        <span key={i} className="flex items-center gap-1">
                          <ChevRight className="h-3 w-3" />
                          <button
                            onClick={() => handleBreadcrumb(i)}
                            className={`hover:text-black transition-colors ${i === breadcrumbs.length - 1 ? "font-bold text-black" : ""}`}
                          >
                            {crumb}
                          </button>
                        </span>
                      ))}
                    </div>
                  </div>
                  <a
                    href={selectedClient.driveUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wide border border-black px-3 py-1.5 hover:bg-black hover:text-white transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    Abrir no Drive
                  </a>
                </div>

                {/* Back button */}
                {breadcrumbs.length > 0 && (
                  <button
                    onClick={() => handleBreadcrumb(breadcrumbs.length - 2)}
                    className="flex items-center gap-1.5 text-xs font-medium text-gray-500 hover:text-black mb-3 transition-colors"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                    Voltar
                  </button>
                )}

                {/* Files list */}
                {loadingFiles ? (
                  <div className="flex justify-center py-12">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
                  </div>
                ) : files.length === 0 ? (
                  <div className="border-2 border-dashed border-gray-200 p-12 text-center">
                    <Folder className="h-10 w-10 text-gray-200 mx-auto mb-3" />
                    <p className="text-sm text-gray-400">Pasta vazia</p>
                  </div>
                ) : (
                  <div className="border border-black">
                    {/* Header row */}
                    <div className="grid grid-cols-12 px-4 py-2 bg-black text-white text-[10px] font-bold uppercase tracking-widest">
                      <div className="col-span-6">Nome</div>
                      <div className="col-span-3">Tipo</div>
                      <div className="col-span-2">Tamanho</div>
                      <div className="col-span-1 text-right">Ação</div>
                    </div>
                    {files.map((file, idx) => (
                      <div
                        key={file.id}
                        className={`grid grid-cols-12 px-4 py-2.5 items-center border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors group ${
                          idx % 2 === 0 ? "bg-white" : "bg-gray-50/50"
                        }`}
                      >
                        {/* Name */}
                        <div className="col-span-6 flex items-center gap-2 min-w-0">
                          {ICON_MAP[file.icon] ?? ICON_MAP.file}
                          {file.isDir ? (
                            <button
                              onClick={() => handleFolderClick(file)}
                              className="text-sm font-semibold text-black hover:text-[oklch(0.45_0.22_27)] transition-colors truncate text-left"
                            >
                              {file.name}
                            </button>
                          ) : (
                            <span className="text-sm text-gray-700 truncate">{file.name}</span>
                          )}
                        </div>
                        {/* Type */}
                        <div className="col-span-3 text-xs text-gray-400 truncate">
                          {file.isDir ? "Pasta" : file.icon.charAt(0).toUpperCase() + file.icon.slice(1)}
                        </div>
                        {/* Size */}
                        <div className="col-span-2 text-xs text-gray-400">
                          {file.isDir ? "—" : formatSize(file.size)}
                        </div>
                        {/* Action */}
                        <div className="col-span-1 flex justify-end">
                          <a
                            href={file.driveUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="opacity-0 group-hover:opacity-100 transition-opacity p-1 hover:bg-gray-200"
                            title="Abrir no Drive"
                          >
                            <ExternalLink className="h-3.5 w-3.5 text-gray-500" />
                          </a>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Empty state */}
            {!search && !selectedClient && (
              <div className="flex flex-col items-center justify-center h-full text-center p-12">
                <div className="w-16 h-16 bg-[oklch(0.45_0.22_27)] flex items-center justify-center mb-6">
                  <FolderOpen className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-xl font-black tracking-tight mb-2">Selecione um cliente</h3>
                <p className="text-sm text-gray-400 max-w-xs">
                  Escolha um cliente na lista à esquerda para ver seus documentos, ou use a busca para encontrar arquivos específicos.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
}

// ─── Helper Components ────────────────────────────────────────────────────────

function ChevRight({ className }: { className?: string }) {
  return <ChevronRight className={className} />;
}

function SearchResultRow({
  icon,
  name,
  subtitle,
  driveUrl,
  onOpen,
}: {
  icon: React.ReactNode;
  name: string;
  subtitle: string;
  driveUrl: string;
  onOpen?: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3 px-3 py-2.5 border border-gray-100 hover:border-black hover:bg-gray-50 transition-all group">
      <div className="flex items-center gap-3 min-w-0">
        {icon}
        <div className="min-w-0">
          <p className="text-sm font-semibold text-black truncate">{name}</p>
          <p className="text-xs text-gray-400">{subtitle}</p>
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        {onOpen && (
          <button
            onClick={onOpen}
            className="text-xs font-medium border border-black px-2 py-1 hover:bg-black hover:text-white transition-colors opacity-0 group-hover:opacity-100"
          >
            Ver
          </button>
        )}
        <a
          href={driveUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="p-1.5 hover:bg-gray-200 transition-colors opacity-0 group-hover:opacity-100"
          title="Abrir no Drive"
        >
          <ExternalLink className="h-3.5 w-3.5 text-gray-500" />
        </a>
      </div>
    </div>
  );
}
