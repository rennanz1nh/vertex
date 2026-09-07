import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { useToast } from '@/hooks/use-toast';
import { Database } from '@/integrations/supabase/types';

type ClientType = Database['public']['Enums']['client_type'];
type SalesChannel = Database['public']['Enums']['sales_channel'];

const clientSchema = z.object({
  nome_razao: z.string().min(1, 'Nome/Razão Social é obrigatório'),
  tipo: z.enum(['Salão/Cabeleireira', 'Revendedor', 'Online/Marketplace', 'Cliente Final'] as const),
  email: z.union([z.string().email('Email inválido'), z.literal('')]).optional().transform(val => val || null),
  telefone: z.string().optional(),
  contato_responsavel: z.string().optional(),
  endereco_rua: z.string().optional(),
  endereco_cidade: z.string().optional(),
  endereco_estado: z.string().optional(),
  endereco_cep: z.string().optional(),
  endereco_pais: z.string().optional(),
  canal_principal: z.enum(['eBay', 'Amazon', 'Etsy', 'Outros'] as const).optional(),
  observacoes: z.string().optional(),
});

type ClientFormData = z.infer<typeof clientSchema>;

interface ClientFormProps {
  client?: any;
  onSuccess: () => void;
  onCancel: () => void;
}

export function ClientForm({ client, onSuccess, onCancel }: ClientFormProps) {
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const form = useForm<ClientFormData>({
    resolver: zodResolver(clientSchema),
    defaultValues: {
      nome_razao: client?.nome_razao || '',
      tipo: client?.tipo || 'Cliente Final',
      email: client?.email || '',
      telefone: client?.telefone || '',
      contato_responsavel: client?.contato_responsavel || '',
      endereco_rua: client?.endereco_rua || '',
      endereco_cidade: client?.endereco_cidade || '',
      endereco_estado: client?.endereco_estado || '',
      endereco_cep: client?.endereco_cep || '',
      endereco_pais: client?.endereco_pais || 'Brasil',
      canal_principal: client?.canal_principal || undefined,
      observacoes: client?.observacoes || '',
    },
  });

  const onSubmit = async (data: ClientFormData) => {
    setIsLoading(true);
    try {
      const cleanData = {
        ...data,
        email: data.email || null,
        telefone: data.telefone || null,
        contato_responsavel: data.contato_responsavel || null,
        endereco_rua: data.endereco_rua || null,
        endereco_cidade: data.endereco_cidade || null,
        endereco_estado: data.endereco_estado || null,
        endereco_cep: data.endereco_cep || null,
        endereco_pais: data.endereco_pais || 'Brasil',
        canal_principal: data.canal_principal || null,
        observacoes: data.observacoes || null,
      };

      if (client) {
        const { error } = await supabase
          .from('clients')
          .update(cleanData)
          .eq('id', client.id);

        if (error) throw error;
        toast({ title: 'Cliente atualizado com sucesso!' });
      } else {
        const { error } = await supabase
          .from('clients')
          .insert([cleanData]);

        if (error) throw error;
        toast({ title: 'Cliente criado com sucesso!' });
      }

      onSuccess();
    } catch (error) {
      console.error('Error saving client:', error);
      toast({
        title: 'Erro ao salvar cliente',
        description: 'Tente novamente mais tarde.',
        variant: 'destructive',
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="nome_razao"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nome/Razão Social *</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="tipo"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Tipo *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="Salão/Cabeleireira">Salão/Cabeleireira</SelectItem>
                    <SelectItem value="Revendedor">Revendedor</SelectItem>
                    <SelectItem value="Online/Marketplace">Online/Marketplace</SelectItem>
                    <SelectItem value="Cliente Final">Cliente Final</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="email"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Email</FormLabel>
                <FormControl>
                  <Input type="email" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="telefone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Telefone</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="contato_responsavel"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Contato Responsável</FormLabel>
              <FormControl>
                <Input {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="endereco_rua"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Endereço</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="endereco_cidade"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Cidade</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <FormField
            control={form.control}
            name="endereco_estado"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Estado</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="endereco_cep"
            render={({ field }) => (
              <FormItem>
                <FormLabel>CEP</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="endereco_pais"
            render={({ field }) => (
              <FormItem>
                <FormLabel>País</FormLabel>
                <FormControl>
                  <Input {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="canal_principal"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Canal Principal</FormLabel>
              <Select onValueChange={field.onChange} defaultValue={field.value}>
                <FormControl>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                </FormControl>
                <SelectContent>
                  <SelectItem value="eBay">eBay</SelectItem>
                  <SelectItem value="Amazon">Amazon</SelectItem>
                  <SelectItem value="Etsy">Etsy</SelectItem>
                  <SelectItem value="Outros">Outros</SelectItem>
                </SelectContent>
              </Select>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="observacoes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Observações</FormLabel>
              <FormControl>
                <Textarea {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancelar
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? 'Salvando...' : client ? 'Atualizar' : 'Criar'}
          </Button>
        </div>
      </form>
    </Form>
  );
}