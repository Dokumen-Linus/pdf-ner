\restrict KWHhclXdQbLm77ST5WiGH2nzIHvXabcImJoWDwyOksUeMX9b0DiaxTE0fSpgFCH

-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: api; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA api;


--
-- Name: auth; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA auth;


--
-- Name: web; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA web;


--
-- Name: workers; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA workers;


--
-- Name: set_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: pdfs; Type: TABLE; Schema: api; Owner: -
--

CREATE TABLE api.pdfs (
    id uuid NOT NULL,
    bookmarks text[],
    original_has_text boolean
);


--
-- Name: prompts; Type: TABLE; Schema: api; Owner: -
--

CREATE TABLE api.prompts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    template_id bigint,
    full_text text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: std_entity_types; Type: TABLE; Schema: api; Owner: -
--

CREATE TABLE api.std_entity_types (
    id bigint NOT NULL,
    short_name text NOT NULL,
    long_name text NOT NULL,
    category text NOT NULL,
    definition text NOT NULL,
    examples text[],
    format_description text,
    datatype text,
    regex text,
    exact_length integer,
    single_word boolean,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT std_entity_types_datatype_check CHECK ((datatype = ANY (ARRAY['int'::text, 'float'::text, 'alphanumeric'::text, 'alpha'::text])))
);


--
-- Name: std_entity_types_id_seq; Type: SEQUENCE; Schema: api; Owner: -
--

ALTER TABLE api.std_entity_types ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME api.std_entity_types_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: templates; Type: TABLE; Schema: api; Owner: -
--

CREATE TABLE api.templates (
    id bigint NOT NULL,
    txt text NOT NULL,
    inserts text[] NOT NULL,
    document_at_end boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: templates_id_seq; Type: SEQUENCE; Schema: api; Owner: -
--

ALTER TABLE api.templates ALTER COLUMN id ADD GENERATED ALWAYS AS IDENTITY (
    SEQUENCE NAME api.templates_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- Name: aws_buckets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.aws_buckets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    region text DEFAULT 'us-east-1'::text NOT NULL,
    access_key_id text NOT NULL,
    secret_access_key text NOT NULL,
    endpoint_url text,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: models; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.models (
    id text NOT NULL,
    provider text NOT NULL,
    usd_per_1m_input numeric(10,4) NOT NULL,
    usd_per_1m_output numeric(10,4) NOT NULL,
    release_date timestamp with time zone NOT NULL,
    available_date timestamp with time zone DEFAULT now() NOT NULL,
    end_available_date timestamp with time zone,
    CONSTRAINT models_provider_check CHECK ((provider = ANY (ARRAY['openai'::text, 'anthropic'::text, 'google'::text])))
);


--
-- Name: schema_migrations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.schema_migrations (
    version character varying NOT NULL
);


--
-- Name: annotations; Type: TABLE; Schema: web; Owner: -
--

CREATE TABLE web.annotations (
    id uuid NOT NULL,
    pdf_id uuid NOT NULL,
    subtype text NOT NULL,
    rect jsonb NOT NULL,
    segment_rects jsonb NOT NULL,
    page_index integer NOT NULL,
    color text,
    opacity real,
    contents text,
    custom_entity_type text,
    author text,
    created timestamp without time zone,
    modified timestamp without time zone,
    blend_mode text,
    CONSTRAINT annotations_blend_mode_check CHECK ((blend_mode = ANY (ARRAY['Normal'::text, 'Multiply'::text, 'Screen'::text, 'Overlay'::text, 'Darken'::text, 'Lighten'::text, 'ColorDodge'::text, 'ColorBurn'::text, 'HardLight'::text, 'SoftLight'::text, 'Difference'::text, 'Exclusion'::text, 'Hue'::text, 'Saturation'::text, 'Color'::text, 'Luminosity'::text]))),
    CONSTRAINT annotations_subtype_check CHECK ((subtype = ANY (ARRAY['highlight'::text, 'underline'::text, 'squiggly'::text, 'strikeout'::text])))
);


--
-- Name: entity_types; Type: TABLE; Schema: web; Owner: -
--

CREATE TABLE web.entity_types (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    name text NOT NULL,
    standard_entity_type_id bigint,
    user_definition text,
    user_examples text[],
    user_format_description text,
    datatype text,
    single_word boolean,
    exact_length integer,
    "unique" boolean NOT NULL,
    required boolean NOT NULL,
    subtype text,
    color text,
    opacity real,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT entity_types_color_check CHECK ((color ~ '^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$'::text)),
    CONSTRAINT entity_types_datatype_check CHECK ((datatype = ANY (ARRAY['int'::text, 'float'::text, 'alphanumeric'::text, 'alpha'::text]))),
    CONSTRAINT entity_types_opacity_check CHECK (((opacity >= (0)::double precision) AND (opacity <= (1)::double precision))),
    CONSTRAINT entity_types_subtype_check CHECK ((subtype = ANY (ARRAY['highlight'::text, 'underline'::text, 'squiggly'::text, 'strikeout'::text])))
);


--
-- Name: pdfs; Type: TABLE; Schema: web; Owner: -
--

CREATE TABLE web.pdfs (
    id uuid NOT NULL,
    labeled_entities jsonb,
    uploaded_by uuid,
    first_viewed_at timestamp with time zone DEFAULT now()
);


--
-- Name: projects; Type: TABLE; Schema: web; Owner: -
--

CREATE TABLE web.projects (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    owner_id uuid NOT NULL,
    name text NOT NULL,
    description text,
    color_presets text[],
    orientation text DEFAULT 'any'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    bucket_id uuid,
    CONSTRAINT projects_orientation_check CHECK ((orientation = ANY (ARRAY['any'::text, 'portrait'::text, 'landscape'::text])))
);


--
-- Name: users; Type: TABLE; Schema: web; Owner: -
--

CREATE TABLE web.users (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    email text NOT NULL,
    first_name text,
    last_name text,
    employer text,
    job_title text,
    avatar_url text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    display_name text
);


--
-- Name: llm_usage; Type: TABLE; Schema: workers; Owner: -
--

CREATE TABLE workers.llm_usage (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    project_id uuid,
    provider text NOT NULL,
    model text NOT NULL,
    source text NOT NULL,
    task_name text,
    input_tokens integer DEFAULT 0 NOT NULL,
    output_tokens integer DEFAULT 0 NOT NULL,
    cost_usd numeric(12,8) DEFAULT 0 NOT NULL,
    stripe_reported boolean DEFAULT false NOT NULL,
    stripe_usage_event_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT llm_usage_source_check CHECK ((source = ANY (ARRAY['api'::text, 'worker'::text])))
);


--
-- Name: optimized_prompts; Type: TABLE; Schema: workers; Owner: -
--

CREATE TABLE workers.optimized_prompts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    project_id uuid NOT NULL,
    full_text text NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: pdfs; Type: TABLE; Schema: workers; Owner: -
--

CREATE TABLE workers.pdfs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text,
    bucket_id uuid NOT NULL,
    filepath text NOT NULL,
    project_id uuid NOT NULL,
    full_text text,
    extract_method text,
    text_by_page jsonb,
    text_by_bookmarks jsonb,
    predicted_entities jsonb,
    model_type text,
    model text,
    prompt_id uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT pdfs_extract_method_check CHECK ((extract_method = ANY (ARRAY['pdfium'::text, 'tesseract'::text, 'olm'::text, 'deepseek'::text]))),
    CONSTRAINT pdfs_model_type_check CHECK ((model_type = ANY (ARRAY['SLM'::text, 'LLM'::text])))
);


--
-- Name: prompt_evaluations; Type: TABLE; Schema: workers; Owner: -
--

CREATE TABLE workers.prompt_evaluations (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    prompt_id uuid NOT NULL,
    overall_f1 real NOT NULL,
    per_entity_scores jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: stripe_customers; Type: TABLE; Schema: workers; Owner: -
--

CREATE TABLE workers.stripe_customers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    stripe_customer_id text NOT NULL,
    stripe_subscription_id text,
    stripe_subscription_item_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: pdfs pdfs_pkey; Type: CONSTRAINT; Schema: api; Owner: -
--

ALTER TABLE ONLY api.pdfs
    ADD CONSTRAINT pdfs_pkey PRIMARY KEY (id);


--
-- Name: prompts prompts_pkey; Type: CONSTRAINT; Schema: api; Owner: -
--

ALTER TABLE ONLY api.prompts
    ADD CONSTRAINT prompts_pkey PRIMARY KEY (id);


--
-- Name: std_entity_types std_entity_types_pkey; Type: CONSTRAINT; Schema: api; Owner: -
--

ALTER TABLE ONLY api.std_entity_types
    ADD CONSTRAINT std_entity_types_pkey PRIMARY KEY (id);


--
-- Name: templates templates_pkey; Type: CONSTRAINT; Schema: api; Owner: -
--

ALTER TABLE ONLY api.templates
    ADD CONSTRAINT templates_pkey PRIMARY KEY (id);


--
-- Name: aws_buckets aws_buckets_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aws_buckets
    ADD CONSTRAINT aws_buckets_name_key UNIQUE (name);


--
-- Name: aws_buckets aws_buckets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.aws_buckets
    ADD CONSTRAINT aws_buckets_pkey PRIMARY KEY (id);


--
-- Name: models models_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.models
    ADD CONSTRAINT models_pkey PRIMARY KEY (id);


--
-- Name: schema_migrations schema_migrations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.schema_migrations
    ADD CONSTRAINT schema_migrations_pkey PRIMARY KEY (version);


--
-- Name: annotations annotations_pkey; Type: CONSTRAINT; Schema: web; Owner: -
--

ALTER TABLE ONLY web.annotations
    ADD CONSTRAINT annotations_pkey PRIMARY KEY (id);


--
-- Name: entity_types entity_types_pkey; Type: CONSTRAINT; Schema: web; Owner: -
--

ALTER TABLE ONLY web.entity_types
    ADD CONSTRAINT entity_types_pkey PRIMARY KEY (id);


--
-- Name: pdfs pdfs_pkey; Type: CONSTRAINT; Schema: web; Owner: -
--

ALTER TABLE ONLY web.pdfs
    ADD CONSTRAINT pdfs_pkey PRIMARY KEY (id);


--
-- Name: projects projects_pkey; Type: CONSTRAINT; Schema: web; Owner: -
--

ALTER TABLE ONLY web.projects
    ADD CONSTRAINT projects_pkey PRIMARY KEY (id);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: web; Owner: -
--

ALTER TABLE ONLY web.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: llm_usage llm_usage_pkey; Type: CONSTRAINT; Schema: workers; Owner: -
--

ALTER TABLE ONLY workers.llm_usage
    ADD CONSTRAINT llm_usage_pkey PRIMARY KEY (id);


--
-- Name: optimized_prompts optimized_prompts_pkey; Type: CONSTRAINT; Schema: workers; Owner: -
--

ALTER TABLE ONLY workers.optimized_prompts
    ADD CONSTRAINT optimized_prompts_pkey PRIMARY KEY (id);


--
-- Name: pdfs pdfs_pkey; Type: CONSTRAINT; Schema: workers; Owner: -
--

ALTER TABLE ONLY workers.pdfs
    ADD CONSTRAINT pdfs_pkey PRIMARY KEY (id);


--
-- Name: prompt_evaluations prompt_evaluations_pkey; Type: CONSTRAINT; Schema: workers; Owner: -
--

ALTER TABLE ONLY workers.prompt_evaluations
    ADD CONSTRAINT prompt_evaluations_pkey PRIMARY KEY (id);


--
-- Name: stripe_customers stripe_customers_pkey; Type: CONSTRAINT; Schema: workers; Owner: -
--

ALTER TABLE ONLY workers.stripe_customers
    ADD CONSTRAINT stripe_customers_pkey PRIMARY KEY (id);


--
-- Name: stripe_customers stripe_customers_stripe_customer_id_key; Type: CONSTRAINT; Schema: workers; Owner: -
--

ALTER TABLE ONLY workers.stripe_customers
    ADD CONSTRAINT stripe_customers_stripe_customer_id_key UNIQUE (stripe_customer_id);


--
-- Name: stripe_customers stripe_customers_user_id_key; Type: CONSTRAINT; Schema: workers; Owner: -
--

ALTER TABLE ONLY workers.stripe_customers
    ADD CONSTRAINT stripe_customers_user_id_key UNIQUE (user_id);


--
-- Name: llm_usage_created_at_idx; Type: INDEX; Schema: workers; Owner: -
--

CREATE INDEX llm_usage_created_at_idx ON workers.llm_usage USING btree (created_at);


--
-- Name: llm_usage_unreported_idx; Type: INDEX; Schema: workers; Owner: -
--

CREATE INDEX llm_usage_unreported_idx ON workers.llm_usage USING btree (stripe_reported) WHERE (NOT stripe_reported);


--
-- Name: llm_usage_user_id_idx; Type: INDEX; Schema: workers; Owner: -
--

CREATE INDEX llm_usage_user_id_idx ON workers.llm_usage USING btree (user_id);


--
-- Name: prompts prompts_updated_at; Type: TRIGGER; Schema: api; Owner: -
--

CREATE TRIGGER prompts_updated_at BEFORE UPDATE ON api.prompts FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: std_entity_types std_entity_types_updated_at; Type: TRIGGER; Schema: api; Owner: -
--

CREATE TRIGGER std_entity_types_updated_at BEFORE UPDATE ON api.std_entity_types FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: templates templates_updated_at; Type: TRIGGER; Schema: api; Owner: -
--

CREATE TRIGGER templates_updated_at BEFORE UPDATE ON api.templates FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: entity_types entity_types_updated_at; Type: TRIGGER; Schema: web; Owner: -
--

CREATE TRIGGER entity_types_updated_at BEFORE UPDATE ON web.entity_types FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: projects projects_updated_at; Type: TRIGGER; Schema: web; Owner: -
--

CREATE TRIGGER projects_updated_at BEFORE UPDATE ON web.projects FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: users users_updated_at; Type: TRIGGER; Schema: web; Owner: -
--

CREATE TRIGGER users_updated_at BEFORE UPDATE ON web.users FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: pdfs pdfs_updated_at; Type: TRIGGER; Schema: workers; Owner: -
--

CREATE TRIGGER pdfs_updated_at BEFORE UPDATE ON workers.pdfs FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: stripe_customers stripe_customers_updated_at; Type: TRIGGER; Schema: workers; Owner: -
--

CREATE TRIGGER stripe_customers_updated_at BEFORE UPDATE ON workers.stripe_customers FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


--
-- Name: pdfs pdfs_id_fkey; Type: FK CONSTRAINT; Schema: api; Owner: -
--

ALTER TABLE ONLY api.pdfs
    ADD CONSTRAINT pdfs_id_fkey FOREIGN KEY (id) REFERENCES workers.pdfs(id) ON DELETE CASCADE;


--
-- Name: prompts prompts_project_id_fkey; Type: FK CONSTRAINT; Schema: api; Owner: -
--

ALTER TABLE ONLY api.prompts
    ADD CONSTRAINT prompts_project_id_fkey FOREIGN KEY (project_id) REFERENCES web.projects(id) ON DELETE CASCADE;


--
-- Name: prompts prompts_template_id_fkey; Type: FK CONSTRAINT; Schema: api; Owner: -
--

ALTER TABLE ONLY api.prompts
    ADD CONSTRAINT prompts_template_id_fkey FOREIGN KEY (template_id) REFERENCES api.templates(id) ON DELETE CASCADE;


--
-- Name: annotations annotations_pdf_id_fkey; Type: FK CONSTRAINT; Schema: web; Owner: -
--

ALTER TABLE ONLY web.annotations
    ADD CONSTRAINT annotations_pdf_id_fkey FOREIGN KEY (pdf_id) REFERENCES web.pdfs(id) ON DELETE CASCADE;


--
-- Name: entity_types entity_types_project_id_fkey; Type: FK CONSTRAINT; Schema: web; Owner: -
--

ALTER TABLE ONLY web.entity_types
    ADD CONSTRAINT entity_types_project_id_fkey FOREIGN KEY (project_id) REFERENCES web.projects(id) ON DELETE CASCADE;


--
-- Name: entity_types entity_types_standard_entity_type_id_fkey; Type: FK CONSTRAINT; Schema: web; Owner: -
--

ALTER TABLE ONLY web.entity_types
    ADD CONSTRAINT entity_types_standard_entity_type_id_fkey FOREIGN KEY (standard_entity_type_id) REFERENCES api.std_entity_types(id) ON DELETE CASCADE;


--
-- Name: pdfs pdfs_id_fkey; Type: FK CONSTRAINT; Schema: web; Owner: -
--

ALTER TABLE ONLY web.pdfs
    ADD CONSTRAINT pdfs_id_fkey FOREIGN KEY (id) REFERENCES workers.pdfs(id) ON DELETE CASCADE;


--
-- Name: pdfs pdfs_uploaded_by_fkey; Type: FK CONSTRAINT; Schema: web; Owner: -
--

ALTER TABLE ONLY web.pdfs
    ADD CONSTRAINT pdfs_uploaded_by_fkey FOREIGN KEY (uploaded_by) REFERENCES web.users(id) ON DELETE CASCADE;


--
-- Name: projects projects_bucket_id_fkey; Type: FK CONSTRAINT; Schema: web; Owner: -
--

ALTER TABLE ONLY web.projects
    ADD CONSTRAINT projects_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES public.aws_buckets(id);


--
-- Name: projects projects_owner_id_fkey; Type: FK CONSTRAINT; Schema: web; Owner: -
--

ALTER TABLE ONLY web.projects
    ADD CONSTRAINT projects_owner_id_fkey FOREIGN KEY (owner_id) REFERENCES web.users(id) ON DELETE CASCADE;


--
-- Name: llm_usage llm_usage_project_id_fkey; Type: FK CONSTRAINT; Schema: workers; Owner: -
--

ALTER TABLE ONLY workers.llm_usage
    ADD CONSTRAINT llm_usage_project_id_fkey FOREIGN KEY (project_id) REFERENCES web.projects(id) ON DELETE SET NULL;


--
-- Name: llm_usage llm_usage_user_id_fkey; Type: FK CONSTRAINT; Schema: workers; Owner: -
--

ALTER TABLE ONLY workers.llm_usage
    ADD CONSTRAINT llm_usage_user_id_fkey FOREIGN KEY (user_id) REFERENCES web.users(id) ON DELETE SET NULL;


--
-- Name: optimized_prompts optimized_prompts_project_id_fkey; Type: FK CONSTRAINT; Schema: workers; Owner: -
--

ALTER TABLE ONLY workers.optimized_prompts
    ADD CONSTRAINT optimized_prompts_project_id_fkey FOREIGN KEY (project_id) REFERENCES web.projects(id) ON DELETE CASCADE;


--
-- Name: pdfs pdfs_bucket_id_fkey; Type: FK CONSTRAINT; Schema: workers; Owner: -
--

ALTER TABLE ONLY workers.pdfs
    ADD CONSTRAINT pdfs_bucket_id_fkey FOREIGN KEY (bucket_id) REFERENCES public.aws_buckets(id);


--
-- Name: pdfs pdfs_project_id_fkey; Type: FK CONSTRAINT; Schema: workers; Owner: -
--

ALTER TABLE ONLY workers.pdfs
    ADD CONSTRAINT pdfs_project_id_fkey FOREIGN KEY (project_id) REFERENCES web.projects(id) ON DELETE CASCADE;


--
-- Name: pdfs pdfs_prompt_id_fkey; Type: FK CONSTRAINT; Schema: workers; Owner: -
--

ALTER TABLE ONLY workers.pdfs
    ADD CONSTRAINT pdfs_prompt_id_fkey FOREIGN KEY (prompt_id) REFERENCES api.prompts(id) ON DELETE CASCADE;


--
-- Name: prompt_evaluations prompt_evaluations_prompt_id_fkey; Type: FK CONSTRAINT; Schema: workers; Owner: -
--

ALTER TABLE ONLY workers.prompt_evaluations
    ADD CONSTRAINT prompt_evaluations_prompt_id_fkey FOREIGN KEY (prompt_id) REFERENCES workers.optimized_prompts(id) ON DELETE CASCADE;


--
-- Name: stripe_customers stripe_customers_user_id_fkey; Type: FK CONSTRAINT; Schema: workers; Owner: -
--

ALTER TABLE ONLY workers.stripe_customers
    ADD CONSTRAINT stripe_customers_user_id_fkey FOREIGN KEY (user_id) REFERENCES web.users(id) ON DELETE CASCADE;


--
-- PostgreSQL database dump complete
--

\unrestrict KWHhclXdQbLm77ST5WiGH2nzIHvXabcImJoWDwyOksUeMX9b0DiaxTE0fSpgFCH


--
-- Dbmate schema migrations
--

INSERT INTO public.schema_migrations (version) VALUES
    ('00002'),
    ('00010'),
    ('00011'),
    ('00020'),
    ('00030'),
    ('00031'),
    ('00040'),
    ('00041'),
    ('00049'),
    ('00050'),
    ('00051'),
    ('00060'),
    ('00070'),
    ('00080'),
    ('00090'),
    ('00091'),
    ('00092');
