# Doing the Most with LLMs: Pushing Frontier AI Beyond Chat into Autonomous Scientific Discovery

**A Comprehensive Research Report on Closed-Loop Science, Evolutionary Program Discovery, Formal Verification, Multimodal Biology, and Autonomous Laboratory Orchestration**

---

## Executive Summary & Frontier Thesis

For the first decade of modern deep learning, artificial intelligence functioned primarily as a high-capacity perceptual tool: classifying images, detecting patterns, or acting as statistical discriminators. With the emergence of Large Language Models (LLMs), AI briefly settled into the role of a conversational assistant—summarizing PDFs, drafting literature reviews, and offering generic conversational answers. 

However, over the last 24 months, a profound scientific and epistemic inflection has taken place. Frontier researchers at Google DeepMind, UC Berkeley, Lawrence Berkeley National Laboratory (LBNL), Carnegie Mellon University (CMU), Sakana AI, FutureHouse, EvolutionaryScale, and NVIDIA have radically repurposed LLMs. Rather than treating LLMs as text-generation chatbots, these pioneers treat language models as **flexible semantic compilers, hypothesis generators, and high-level reasoning engines embedded inside rigorous, non-LLM verification loops**.

```
                   ┌────────────────────────────────────────┐
                   │    Frontier LLM / Foundation Model     │
                   │ (Hypothesis Generation & Code Writing) │
                   └──────────────────┬─────────────────────┘
                                      │ Code / Action / Formal Syntax
                                      ▼
                   ┌────────────────────────────────────────┐
                   │       Objective Verification Layer     │
                   │  - Lean 4 Theorem Verifier             │
                   │  - Automated Code / Test Evaluator     │
                   │  - Physics Engine (Isaac Gym / PDEs)   │
                   │  - Robotic Hardware / XRD Lab Sensors  │
                   └──────────────────┬─────────────────────┘
                                      │ Quantitative Metrics & Errors
                                      ▼
                   ┌────────────────────────────────────────┐
                   │      Evolutionary / Active Feedback    │
                   │    (Prompt DB, MCTS, Genetic Pool)     │
                   └──────────────────┬─────────────────────┘
                                      │ Refined Context
                                      └───────► (Repeat Loop)
```

By decoupling generative creativity from evaluation, frontier scientific systems bypass the fundamental Achilles' heel of language models—hallucination. When an LLM generates a proposed solution, it is not trusted on its face. Instead, it is executed against an immutable ground truth:
1. **In Mathematics:** Executed through formal proof assistants (Lean 4) or code sandboxes (*AlphaProof*, *AlphaGeometry*, *FunSearch*).
2. **In Robotics & Physics:** Executed in massively parallel physics simulators or numerical PDE engines (*Eureka*, *DrEureka*, *CodePDE*).
3. **In Chemistry & Materials Science:** Executed by robotic liquid handlers, furnaces, and automated X-ray diffraction systems (*Coscientist*, *A-Lab*, *ChemCrow*).
4. **In Molecular Biology:** Executed through generative de novo sequence-structure models validated by wet-lab synthesis (*ESM3*, *OpenCRISPR-1*, *AlphaFold 3*).
5. **In Autonomous Research:** Executed end-to-end across ideation, coding, experiment execution, manuscript drafting, and automated peer review (*The AI Scientist*, *FutureHouse Kosmos*).

This report documents the state of the art in frontier scientific AI, providing deep architectural dissections, quantitative benchmarks, and comprehensive primary literature citations across each domain.

---

## 1. Closed-Loop Autonomous Science & Self-Driving Labs (SDLs)

The physical laboratory has historically represented the slowest bottleneck in the scientific method. While computational simulations can execute millions of calculations per second, physical experiments—mixing reagents, calibrating temperatures, monitoring reaction kinetics, and isolating products—traditionally rely on manual human intervention. Self-Driving Labs (SDLs) powered by LLMs have closed this loop by turning natural-language objectives into executable hardware commands, interpreting real-time instrument telemetry, and dynamically revising experimental protocols.

```
       +-------------------------------------------------------+
       |           Plain-Language Scientific Objective         |
       |  "Synthesize novel organocatalyst with >80% yield"    |
       +---------------------------+---------------------------+
                                   |
                                   v
       +-------------------------------------------------------+
       |               LLM Agent (ReAct / Planning)            |
       |  - Information Retrieval (Web, Papers, Patents)       |
       |  - Stoichiometry Calculation & Safety Audit           |
       |  - Code Generation for Robotic APIs (Python / Opentrons)|
       +---------------------------+---------------------------+
                                   | Executable Hardware Script
                                   v
       +-------------------------------------------------------+
       |            Robotic Wet Lab / Hardware Layer           |
       |  - Automated Liquid Handlers (Opentrons OT-2)         |
       |  - Heating Shakers, Microplate Spectrophotometers     |
       |  - Cloud Laboratories (Emerald Cloud Lab, Strateos)   |
       +---------------------------+---------------------------+
                                   | Sensor Readings & Yield Data
                                   v
       +-------------------------------------------------------+
       |              Active Learning & Optimization           |
       |  - Bayesian Optimization / Pareto Surface Search      |
       |  - Iterative Protocol Refinement                      |
       +---------------------------+---------------------------+
                                   | Feedback Loop
                                   +--------> Back to LLM
```

### 1.1 Coscientist: Autonomous Chemical Research in the Physical Lab
Published in *Nature* (December 2023) by Daniil A. Boiko, Robert MacKnight, Ben Kline, and Gabriel dos Passos Gomes at Carnegie Mellon University, **Coscientist** represents one of the first systems where an LLM independently planned, coded, and physically executed complex chemical reactions.

- **Primary Source:** Boiko, D. A., MacKnight, R., Kline, B., & Gomes, G. dos P. (2023). *Autonomous chemical research with large language models.* **Nature**, 624(7992), 570–578. [DOI: 10.1038/s41586-023-06792-0](https://doi.org/10.1038/s41586-023-06792-0).
- **Core Architecture:** Coscientist is composed of communicating modules orchestrated by GPT-4:
  - *Web Searcher:* Queries online chemical documentation, Wikipedia, and PubChem via Google Custom Search API.
  - *Code Execution Sandbox:* Translates reaction protocols into Python scripts utilizing the Opentrons API (`opentrons.execute`).
  - *Documentation Indexer:* Ingests API manuals for automated liquid-handling systems to ensure synthesized code adheres to physical deck configurations (pipette tips, well plates, temperature modules).
  - *Hardware Interface:* Sends commands to an Opentrons OT-2 robotic liquid handler or cloud laboratory infrastructure (Emerald Cloud Lab).
- **Physical Demonstrations:**
  - *Complex Organic Synthesis Planning:* Planned synthetic routes for standard active pharmaceutical ingredients (APIs), including paracetamol, aspirin, and phenacetin.
  - *Catalytic Cross-Coupling Optimization:* Coscientist successfully executed palladium-catalyzed Suzuki-Miyaura cross-coupling reactions—a staple reaction in medicinal chemistry that was awarded the 2010 Nobel Prize in Chemistry. The agent selected reagents, calculated concentrations, instructed the robotic arm to dispense reagents into multi-well plates, ran the heating-shaking cycle, and optimized reaction parameters over multiple iterations based on spectrophotometric absorbance data.
- **Safety and Dual-Use Auditing:** The study explicitly tested the system against Chemical Weapons Convention schedules and toxic chemical precursors. When prompted to synthesize dangerous agents (e.g., nerve agents, ricin, explosives), unguarded LLMs produced executable plans; the authors developed explicit domain-aware guardrails that cross-referenced target CAS numbers against DHS and OPCW restriction registries before any hardware command was dispatched.

---

### 1.2 A-Lab: Berkeley/LBNL's Autonomous Solid-State Materials Lab
While Coscientist automated liquid chemistry, **A-Lab** (Autonomous Laboratory) at Lawrence Berkeley National Laboratory and UC Berkeley automated high-temperature solid-state inorganic materials synthesis.

- **Primary Source:** Szymanski, N. J., Rendy, B., Fei, Y., Kumar, R. E., He, T., Milsted, D., McDermott, M. J., Gallant, M., Park, E., Huo, H., Merchant, A., Cubuk, E. D., Ceder, G., et al. (2023). *An autonomous laboratory for the accelerated synthesis of novel materials.* **Nature**, 624(7991), 286–291. [DOI: 10.1038/s41586-023-06734-w](https://doi.org/10.1038/s41586-023-06734-w).
- **The Synthesis Challenge:** In materials science, moving from a computationally predicted crystal structure (e.g., a ternary oxide or phosphate) to a physically synthesized powder requires finding the correct precursors, mixing stoichiometry, milling parameters, annealing temperature profiles, and atmosphere controls. Historically, this takes months per compound.
- **System Workflow:**
  1. *Candidate Selection:* Targets were ingested directly from Google DeepMind's GNoME database and the Materials Project.
  2. *Literature Synthesis via NLP:* Historical synthesis recipes were mined from tens of thousands of published materials science papers using NLP to extract precursor affinities and reaction conditions.
  3. *Autonomous Robotics:* A robotic arm handled powder dosing, planetary ball milling, crucible loading, high-temperature furnace heating (up to 1,200 °C), and sample delivery to an on-site X-ray diffractometer (XRD).
  4. *Active-Learning Rietveld Refinement:* After XRD data collection, an automated Rietveld refinement algorithm determined whether the target crystal phase had formed, calculated impurity fractions, and iteratively updated the thermodynamic reaction model. If an experiment yielded an unreacted or multiphase mixture, the active learning engine modified reaction temperatures and precursor ratios.
- **Empirical Results:** Operating continuously for **17 days without human intervention**, A-Lab executed 355 experiments targeting 58 distinct compounds. It successfully synthesized **41 novel inorganic compounds** (a **71% success rate**), dramatically demonstrating that autonomous labs can outpace human experimental velocity by multiple orders of magnitude.

---

### 1.3 ChemCrow: Tool-Augmented Chemistry Reasoning
Developed collaboratively by EPFL, the University of Rochester, IBM Research, and FutureHouse, **ChemCrow** proved that augmenting LLMs with domain-specific computational tools resolves the chemical inaccuracies common in standard conversational models.

- **Primary Source:** Bran, A. M., Cox, S., Schilter, O., Baldassari, C., Christofely, M. R., White, A. D., & Schwaller, P. (2024). *ChemCrow: Augmenting large-language models with chemistry tools.* **Nature Machine Intelligence**, 6(5), 525–535. [DOI: 10.1038/s42256-024-00832-8](https://doi.org/10.1038/s42256-024-00832-8); Preprint: [arXiv:2304.05376](https://arxiv.org/abs/2304.05376).
- **Tool Suite Integration:** ChemCrow integrates an LLM reasoning core with **18 expert tools** across chemistry:
  - *Reaction Planning:* Inerfaces with IBM RXN for reaction prediction and retrosynthesis.
  - *Molecular Informatics:* RDKit for SMILES canonicalization, molecular weight, fingerprinting, and substructure matching.
  - *Safety & Databases:* PubChem, Wikipedia, literature search, and safety data sheet (SDS) lookup tools.
  - *Experimental Execution:* Interfaces with chemical robotics platforms.
- **Experimental Validations:** ChemCrow autonomously planned and guided the physical synthesis of multiple targets, including insect repellents (DEET analogs), three organocatalysts, and led to the discovery of a novel chromophore. 
- **Methodological Takeaway:** The authors demonstrated that vanilla LLMs score poorly on chemical logic, but when allowed to call deterministic tools and observe standard output traces, the model functions as a competent, high-level scientific orchestrator.

---

## 2. Algorithm & Mathematical Discovery via Evolutionary LLM Loops

A long-standing criticism of large language models is that they are merely "stochastic parrots," incapable of discovering genuinely new scientific truths or outperforming their training distributions. In late 2023 and 2024, researchers shattered this assumption by embedding LLMs inside evolutionary search loops and neuro-symbolic theorem provers.

```
                  ┌──────────────────────────────────────────────┐
                  │       Evolutionary Prompt Database           │
                  │   (Maintains population of best programs)    │
                  └──────────────────────┬───────────────────────┘
                                         │ Samples top candidates
                                         ▼
                  ┌──────────────────────────────────────────────┐
                  │        LLM Generator (e.g. Codey)            │
                  │  (Mutates & improves program logic)          │
                  └──────────────────────┬───────────────────────┘
                                         │ Emits modified Python code
                                         ▼
                  ┌──────────────────────────────────────────────┐
                  │      Deterministic Evaluator Sandbox         │
                  │  (Executes code against rigorous criteria)   │
                  │  - Checks mathematical invariants           │
                  │  - Computes objective function score         │
                  └──────────────────────┬───────────────────────┘
                                         │
                         ┌───────────────┴───────────────┐
                         │ Higher Score?                 │
                         ▼                               ▼
                     [  YES  ]                       [  NO  ]
             Added to Prompt DB               Discarded / Logged
          New mathematical discovery!
```

### 2.1 FunSearch: Mathematical Discoveries in Function Space
Published in *Nature* (January 2024) by Bernardino Romera-Paredes, Mohammadamin Barekatain, Alexander Novikov, Jordan S. Ellenberg, Pushmeet Kohli, and Alhussein Fawzi at Google DeepMind, **FunSearch** (searching in the **Fun**ction space) marked the first time an LLM-driven system made a new discovery in open mathematical research.

- **Primary Source:** Romera-Paredes, B., Barekatain, M., Novikov, A., Lu, M., Kumar, N., Gardner, C., ... Fawzi, A. (2024). *Mathematical discoveries from program search with large language models.* **Nature**, 625(7995), 472–478. [DOI: 10.1038/s41586-023-06924-6](https://doi.org/10.1038/s41586-023-06924-6).
- **Core Mechanism:**
  - *The Representation:* Instead of prompting the LLM to write mathematical proofs in prose or output raw numerical answers, FunSearch prompts the LLM to write a **Python function** that implements a heuristic for constructing mathematical objects.
  - *The Evaluator:* The candidate function is executed in a secure sandbox against an exact evaluation suite that calculates the size of the constructed set or the efficiency of the heuristic.
  - *Islands Model (Evolutionary Search):* Solutions are stored in an evolutionary database with multiple isolated subpopulations ("islands"). The LLM periodically selects high-scoring programs from an island, mutates or recombines their logic, and submits the new program to the evaluator.
- **The Breakthroughs:**
  1. **The Cap Set Problem (Extremal Combinatorics):** The cap set problem asks for the largest subset of points in the affine geometry $\mathbb{F}_3^n$ (a vector space over 3 elements) such that no three points lie on a single line. In dimension $n = 8$, the largest cap set known to human mathematicians had a size of 496. FunSearch discovered a new construction of size **512**, establishing a new world record. Furthermore, in asymptotic regimes, FunSearch discovered constructions that exceeded known bounds.
  2. **Online Bin Packing:** In computer science, bin packing is a classic NP-hard problem where items of varying sizes must be packed into the minimum number of bins. FunSearch generated brand-new heuristics that outperformed established human-designed algorithms (such as "Best-Fit Decreasing") on real-world industrial distributions.
- **Interpretability Advantage:** Unlike neural network weights or deep reinforcement learning policies, the output of FunSearch is human-readable Python code. Mathematicians (including co-author Jordan Ellenberg) were able to inspect the resulting code, identify the mathematical symmetries exploited by the algorithm, and formalize them into new analytical mathematical theorems.

---

### 2.2 AlphaProof & AlphaGeometry 2: IMO Silver-Medal Reasoning
In July 2024, Google DeepMind unveiled **AlphaProof** and **AlphaGeometry 2**, achieving an official **Silver Medal standard at the 2024 International Mathematical Olympiad (IMO)**—the premier international competition for young mathematicians.

```
Natural Language IMO Problem
           │
           ▼
┌──────────────────────────────────────┐
│ Gemini Formalizer (LLM)              │
│ Translates natural language -> Lean 4│
└──────────────────┬───────────────────┘
                   │ Lean 4 Formal Specification
                   ▼
┌──────────────────────────────────────┐
│ AlphaZero-Style MCTS Searcher        │
│ Generates proof steps (tactics)      │
└──────────────────┬───────────────────┘
                   │ Candidate Tactic
                   ▼
┌──────────────────────────────────────┐
│ Lean 4 Kernel (Formal Verifier)      │
│ "Does this step logically hold?"     │
└──────────────────┬───────────────────┘
         ┌─────────┴─────────┐
         │ Valid?            │
         ▼                   ▼
     [  YES  ]           [  NO  ]
  Expands Tree        Prunes Branch
         │
         ▼ (Proof closed)
    VERIFIED PROOF
```

- **Primary Source (AlphaGeometry 1):** Trinh, T. H., Wu, Y., Le, Q. V., He, H., & Luong, T. (2024). *Solving olympiad-level geometry without human demonstrations.* **Nature**, 625(7995), 476–482. [DOI: 10.1038/s41586-023-06747-5](https://doi.org/10.1038/s41586-023-06747-5).
- **Primary Source (AlphaProof & AlphaGeometry 2):** Google DeepMind Technical Milestone Release (July 2024). *AI achieves silver-medal standard at International Mathematical Olympiad.* [DeepMind Announcement](https://deepmind.google/discover/blog/ai-solves-imo-problems-at-silver-medal-level/).
- **AlphaProof Architecture:**
  - *Formal Language Formalization:* AlphaProof bridges the informal-formal divide. A fine-tuned Gemini model is trained to translate informal, natural-language mathematical problem statements into formal declarations in **Lean 4**, an interactive theorem prover and programming language.
  - *Reinforcement Learning in Lean:* Once formal statements are defined, AlphaProof couples a language model policy with the **AlphaZero** reinforcement learning search algorithm. The Lean compiler provides a binary ground truth: either a tactic sequence is logically valid and advances the proof state, or it throws an error.
  - *Synthetic Proof Curriculum:* To overcome the extreme scarcity of formal Lean proofs, DeepMind auto-formalized millions of informal math problems from diverse curricula into Lean statements, creating an automated reinforcement learning curriculum spanning algebra, combinatorics, and number theory.
- **AlphaGeometry 2:**
  - Upgraded with a Gemini-based neural language model operating alongside a high-performance symbolic deduction engine. It was trained on orders of magnitude more synthetic geometric constructs than AlphaGeometry 1, allowing it to rapidly hypothesize auxiliary constructions (points, circles, perpendiculars) when the symbolic engine reached a deduction impasse.
- **IMO 2024 Performance:**
  - Evaluated on the 6 official problems of the 65th International Mathematical Olympiad held in Bath, UK.
  - AlphaProof solved **3 problems** (Problem 1: Algebra; Problem 2: Algebra/Number Theory; Problem 6: Number Theory—the hardest problem of the competition, which only 5 human contestants solved).
  - AlphaGeometry 2 solved **Problem 4** (Euclidean Geometry) in under 19 seconds.
  - Total score: **28 out of 42**, reaching the exact cutoff for an official IMO Silver Medal. Solutions were vetted and graded by Fields Medalist Sir Timothy Gowers and Dr. Joseph Myers (Chair of the IMO Problem Selection Committee).

---

### 2.3 Eureka & DrEureka: Autonomous Reward Design for Physics & Robotics
In reinforcement learning (RL), setting up the reward function to train complex physical behaviors in robots is a notorious human engineering bottleneck. Researchers from NVIDIA, UPenn, Caltech, and UT Austin developed **Eureka** and **DrEureka**, demonstrating that coding LLMs can autonomously engineer optimal reward functions and physics randomization parameters.

- **Primary Sources:**
  - Ma, Y. J., Liang, W., Wang, G., Huang, D. A., Bastani, O., Jayaraman, D., Zhu, Y., Fan, L., & Anandkumar, A. (2024). *Eureka: Human-level reward design via coding large language models.* **ICLR 2024 (Oral)**; [arXiv:2310.12931](https://arxiv.org/abs/2310.12931).
  - Ma, Y. J., Liang, W., Wang, H., Wang, S., Zhu, Y., Fan, L., Bastani, O., & Jayaraman, D. (2024). *DrEureka: Language model-guided sim-to-real transfer.* **Robotics: Science and Systems (RSS 2024)**; [arXiv:2406.01967](https://arxiv.org/abs/2406.01967).
- **Eureka Workflow:**
  - *Environment as Context:* The LLM receives the raw simulation code (e.g., written for NVIDIA Isaac Gym) describing the robot's physical morphology, degrees of freedom, and physics constraints.
  - *Evolutionary Coding Loop:* The LLM generates candidate reward functions in Python code. Thousands of simulated robot iterations are trained in parallel on GPUs.
  - *Reward Reflection:* Metrics from training (success rates, joint torque violations, trajectory velocity) are formatted into text summaries and fed back to the LLM. The LLM reflects on the policy's failure modes and iteratively rewrites the reward code over multiple generations.
- **Results:** Eureka outperformed human-expert reward engineering on **83% of tasks** across 29 benchmarks. Most strikingly, Eureka trained a 24-DoF simulated robotic Shadow Hand to execute rapid, high-speed **pen spinning tricks**—a dexterous manipulation task that had resisted manual reward design for years.
- **DrEureka (Sim-to-Real Transfer):** DrEureka extended this concept to physical hardware. In addition to reward functions, DrEureka used an LLM to synthesize **Domain Randomization (DR)** parameters (varying friction, motor damping, mass distribution, latency). DrEureka successfully transferred policies directly from simulation to a physical quadruped robot (Unitree Go1), enabling it to balance and walk on top of a dynamic, rolling yoga ball in the real world without human parameter tuning.

---

## 3. The Fully Autonomous AI Scientist

A major philosophical milestone in AI for Science is creating an end-to-end "AI Scientist"—an agentic architecture capable not just of executing isolated tasks, but of managing the entire scientific pipeline: literature review, hypothesis ideation, experimental execution, data analysis, visualization, manuscript preparation, and peer review.

```
                     ┌────────────────────────────────────┐
                     │          Ideation & Rationale      │
                     │  - Scrapes literature / arXiv      │
                     │  - Proposes novel research ideas   │
                     └─────────────────┬──────────────────┘
                                       │
                                       ▼
                     ┌────────────────────────────────────┐
                     │         Code & Experimentation     │
                     │  - Modifies base ML/Science code   │
                     │  - Runs GPU training/simulations   │
                     │  - Catches runtime errors & repairs│
                     └─────────────────┬──────────────────┘
                                       │
                                       ▼
                     ┌────────────────────────────────────┐
                     │     Data Visualization & LaTeX     │
                     │  - Matplotlib / Seaborn figures    │
                     │  - Typesets full conference paper  │
                     └─────────────────┬──────────────────┘
                                       │
                                       ▼
                     ┌────────────────────────────────────┐
                     │        Automated Peer Review       │
                     │  - LLM Reviewer (ICLR/NeurIPS rub.)│
                     │  - Scores novelty & correctness    │
                     └────────────────────────────────────┘
```

### 3.1 Sakana AI's "The AI Scientist": End-to-End Research Generation
Released in August 2024 by Sakana AI in collaboration with the University of Oxford and the University of British Columbia, **The AI Scientist** represents the first fully automated software system for conducting open-ended machine learning research.

- **Primary Source:** Lu, C., Lu, C., Lange, R. T., Foerster, J., Clune, J., & Ha, D. (2024). *The AI Scientist: Towards fully automated open-ended scientific discovery.* **arXiv preprint** [arXiv:2408.06292](https://arxiv.org/abs/2408.06292).
- **The End-to-End Scientific Loop:**
  1. *Ideation:* Given a baseline codebase (e.g., modern diffusion models, transformers, or learning dynamics), the system searches Semantic Scholar for relevant literature, brainstorms novel algorithmic modifications, and filters them against past literature to ensure novelty.
  2. *Experimentation:* It clones the codebase, implements its proposed modifications using an automated coding agent (Aider-style loop), executes experiments on local GPUs, tracks performance metrics, and autonomously debugs execution errors.
  3. *Scientific Writing:* The system collects raw experimental data, renders publication-ready vector plots and tables via Matplotlib, and writes a complete, standard-format scientific manuscript in LaTeX (Abstract, Introduction, Background, Method, Experiments, Results, Discussion, and References).
  4. *Automated Peer Review:* The system passes the resulting PDF to a multimodal LLM reviewer prompted with standard NeurIPS/ICLR evaluation rubrics. The automated reviewer scores the paper for novelty, clarity, methodology, and empirical rigor.
- **Economics of Discovery:** The authors reported that each completed, publication-ready research paper costs **under \$15** in API compute tokens. Independent evaluation indicated that several papers met or exceeded the threshold for acceptance at standard workshop/conference tracks.

---

### 3.2 FutureHouse & Edison Scientific: Superhuman Literature Synthesis and Kosmos
While Sakana AI focused on algorithmic machine learning research, **FutureHouse** (a nonprofit research institute funded by Eric Schmidt) and its commercial spinout **Edison Scientific** (founded by Andrew White and Sam Rodriques) focused on autonomous reasoning over biomedical science.

- **Primary Sources:**
  - White, A. D., et al. (2024). *Language agents achieve superhuman synthesis of scientific knowledge.* **arXiv preprint** [arXiv:2409.13740](https://arxiv.org/abs/2409.13740).
  - FutureHouse & Edison Scientific Technical Overview (2024). *Kosmos: The Autonomous AI Scientist for Biomedical R&D.*
- **PaperQA2:** Standard retrieval-augmented generation (RAG) fails in scientific domains because critical information is buried in tables, supplemental PDFs, and dense methodologies. FutureHouse developed **PaperQA2**, which was tested on **LitQA2**—a rigorous benchmark of questions that cannot be answered by trivial keyword search:
  - *Superhuman Performance:* PaperQA2 outperformed PhD-level biologists and postdoctoral researchers who were given full access to search engines and scientific databases.
  - *Automated Wikipedia Generation (WikiCrow):* Using PaperQA2, FutureHouse generated thousands of cited Wikipedia-style summary articles for under-documented human genes and proteins; human expert reviewers rated the AI-synthesized summaries as more accurate and complete than human-curated equivalents.
  - *Contradiction Hunting:* In a systematic scan of randomly sampled biology literature, PaperQA2 identified an average of **2.3 cross-paper empirical contradictions** per paper, with **~70% confirmed as genuine contradictions** upon human expert validation.
- **Kosmos (Edison Scientific):** Edison Scientific developed **Kosmos**, an enterprise-grade autonomous scientist. Given an experimental dataset and high-level biological prompt, Kosmos autonomously:
  - Digests tens of thousands of relevant papers and patents.
  - Writes and executes complex bioinformatics pipelines (e.g., single-cell RNA-seq, flow cytometry analysis, spatial transcriptomics).
  - Generates auditable research dossiers for pharmaceutical R&D, leading to major industrial deployments (such as an enterprise agreement with Pfizer).

---

## 4. Multimodal Generative Biology & De Novo Design

In structural biology and protein engineering, the classical paradigm relied on screening natural variants or using directed evolution in wet labs. Frontier foundation models treat the central dogma of molecular biology as a multimodal linguistic and generative problem, enabling de novo generation of proteins, enzymes, and genome editors.

```
       NATURAL EVOLUTION:
       Random Mutation ──► Millions of Years ──► Screening ──► Functional Protein

       FRONTIER GENERATIVE AI (ESM3 / OpenCRISPR-1):
       Sequence Tokens  ┐
       Structure Tokens ├─► Masked Language Model ──► Atomic Synthesis ──► Verified Function
       Function Tokens  ┘     (Generative Flow)       (Zero-Shot)        (In Vitro)
```

### 4.1 ESM3: Simulating 500 Million Years of Evolution
In June 2024, **EvolutionaryScale** (founded by the former Meta AI protein team led by Alexander Rives) unveiled **ESM3**, a 98-billion parameter multimodal generative model for programmable biology.

- **Primary Source:** Hayes, T., Rao, R., Akin, H., Sofroniew, N. J., ... Rives, A. (2024). *Simulating 500 million years of evolution with a language model.* **bioRxiv preprint** [bioRxiv:2024.07.01.601570](https://www.biorxiv.org/content/10.1101/2024.07.01.601570v1).
- **Multimodal Tokenization:** ESM3 tokenizes biology across three orthogonal tracks:
  1. *Sequence Track:* 20 canonical amino acid letters.
  2. *Structure Track:* 3D coordinates discretized into discrete structural tokens (quantized invariant coordinate frames).
  3. *Function Track:* Biochemical functional annotations and secondary structure motifs.
- **The esmGFP Breakthrough:**
  - Researchers tasked ESM3 with generating a brand-new Green Fluorescent Protein (GFP)—a complex molecular structure requiring precise beta-barrel folding to catalyze self-chromophore maturation.
  - The model was prompted with partial structural constraints and functional tags. The resulting generated protein, **esmGFP**, was synthesized in the wet lab and exhibited bright green fluorescence.
  - Remarkably, esmGFP shares only **~58% sequence identity** with the closest known natural fluorescent protein. In natural evolutionary history, acquiring that degree of sequence divergence while maintaining active catalytic function requires approximately **500 million years of natural selection**, demonstrating that generative models can leap across vast fitness landscapes.

---

### 4.2 Profluent OpenCRISPR-1: AI-Generated Gene Editors
In April 2024, **Profluent** released **OpenCRISPR-1**, the first functional, completely AI-designed CRISPR-Cas genome editor.

- **Primary Source:** Ruffolo, J. A., Sulser, P., Hashimoto, N., et al. (2024). *Design of highly functional genome editors using language models.* **Nature** / Preprint: [bioRxiv:2024.04.22.590591](https://www.biorxiv.org/content/10.1101/2024.04.22.590591v1).
- **Dataset Scale:** Trained on the **CRISPR-Cas Atlas**, comprising over **26 terabases** of assembled microbial genomes and metagenomes, capturing over **1 million CRISPR operons** and expanding cataloged CRISPR-Cas diversity by nearly 5-fold.
- **Model & In Vitro Verification:**
  - Using large autoregressive and masked protein language models, the researchers generated de novo Cas9-like nucleases.
  - **OpenCRISPR-1** differed from wild-type *Streptococcus pyogenes* Cas9 (SpCas9) by **more than 400 amino acid mutations** (~70% sequence homology).
  - When tested in human cells (HEK293T), OpenCRISPR-1 exhibited **on-target cleavage efficiency and base-editing precision comparable to, and in some loci superior to, natural SpCas9**, while demonstrating substantially reduced off-target activity.
  - Profluent open-sourced OpenCRISPR-1 to democratize precision gene therapy.

---

### 4.3 AlphaFold 3: Modeling the Universal Biomolecular Interactome
Published in *Nature* (May 2024) by Google DeepMind and Isomorphic Labs, **AlphaFold 3** expanded structural biology from pure protein prediction to the universal joint prediction of all biological complexes.

- **Primary Source:** Abramson, J., Adler, J., Dunger, J., Evans, R., Green, T., Pritzel, A., Ronneberger, O., Willmore, L., Jumper, J., Hassabis, D., et al. (2024). *Accurate structure prediction of biomolecular interactions with AlphaFold 3.* **Nature**, 630(8016), 493–500. [DOI: 10.1038/s41586-024-07487-w](https://doi.org/10.1038/s41586-024-07487-w).
- **Architectural Shift to Diffusion:**
  - AlphaFold 2 utilized complex Evoformer modules and structural geometry heads dedicated strictly to peptide bonds.
  - AlphaFold 3 replaced the structural pipeline with a **Pairformer** module and a full **Diffusion Module**. The diffusion module denoises raw atomic 3D coordinates directly, building up molecular complexes atom-by-atom without stereochemical hand-crafting.
- **Scope & Performance:**
  - Predicts complexes containing **proteins, DNA, RNA, small-molecule ligands, metal ions, and chemical modifications (e.g., glycosylation, phosphorylation)** in a single unified network.
  - Outperformed specialized molecular docking software (e.g., Vina, DiffDock) by **over 50%** in protein-ligand interaction benchmarks.
  - Provided structural modeling capabilities for epigenetic regulatory mechanisms, antibody-antigen interfaces, and nucleic-acid enzyme complexes.

---

## 5. Materials Science & Solid-State Discovery

The discovery of novel materials underpins clean energy technologies (batteries, solar cells, thermoelectric devices) and semiconductor manufacturing. The synergy between high-throughput graph neural networks and LLM synthesis planning has radically accelerated the timeline for materials discovery.

### 5.1 GNoME: Expanding Known Inorganic Crystals by an Order of Magnitude
Published in *Nature* (November 2023) alongside Berkeley's A-Lab, Google DeepMind's **GNoME (Graph Networks for Materials Exploration)** transformed solid-state chemistry.

- **Primary Source:** Merchant, A., Batzner, S., Schoenholz, S. S., Aykol, M., Cheon, G., & Cubuk, E. D. (2023). *Scaling deep learning for materials discovery.* **Nature**, 624(7991), 80–85. [DOI: 10.1038/s41586-023-06735-9](https://doi.org/10.1038/s41586-023-06735-9).
- **Active Learning via Graph Neural Networks:**
  - Scaled equivariant graph neural networks to evaluate crystal stability relative to the thermodynamic "convex hull" (the energy threshold below which a compound will not decompose into competing phases).
  - Used iterative active learning: the model hypothesized candidate crystal lattices, performed Density Functional Theory (DFT) calculations to verify energy levels, and incorporated DFT outputs back into training.
- **Results:**
  - Discovered **2.2 million new crystal structures**, of which **381,000 are thermodynamically stable**.
  - Expanded humanity’s cumulative catalog of stable inorganic materials by **an order of magnitude** (from ~48,000 known structures accumulated over historical human science).
  - Provided hundreds of new candidate solid-state lithium and sodium electrolytes for next-generation solid-state batteries.

---

### 5.2 LLM-Driven Synthesis Planning and Retrosynthesis
While GNoME discovered stable crystal coordinates, realizing them in physical laboratories required LLM-driven synthesis planning:
- **Disconnection Prompts and Semantic Retrosynthesis:** Traditional Computer-Aided Synthesis Planning (CASP) relied on static reaction templates. Modern LLM retrosynthesis frameworks (e.g., integrating GPT-4 with AiZynthFinder, ChemTSv2, or IBM RXN) use natural language prompting to steer reactions away from toxic reagents, optimize green chemistry metrics, and propose non-obvious disconnections.
- **Materials Synthesis Planning (MSP):** LLMs translate solid-state phase diagrams into step-by-step precursor selection and furnace temperature schedules, directly feeding automated laboratories like A-Lab.

---

## 6. Symbolic Physics, Simulation & Scientific Code Synthesis

In physical sciences, researchers rarely seek black-box approximations; they seek **governing equations, conservation laws, and verifiable numerical simulation code**. Language models are increasingly deployed to rediscover physical laws from data and write high-performance scientific simulation code.

```
       Experimental Field Data (x, t, u)
                      │
                      ▼
┌──────────────────────────────────────────────┐
│ LLM Prior / Hypothesis Generator             │
│ Proposes candidate functional forms          │
│ e.g. u_t + u * u_x = \nu * u_xx (Burgers)   │
└──────────────────────┬───────────────────────┘
                       │
                       ▼
┌──────────────────────────────────────────────┐
│ Deterministic Optimization & Constant Fitting│
│ (Nonlinear Least Squares / Lasso)            │
└──────────────────────┬───────────────────────┘
                       │ Residuals & Symmetries
                       ▼
┌──────────────────────────────────────────────┐
│ Physics Verifier (Dimension & Conservation)  │
│ Checks energy dissipation, Galilean invariance│
└──────────────────────────────────────────────┘
```

### 6.1 LLM-Guided Symbolic Regression & Equation Discovery
Symbolic regression aims to extract interpretable, closed-form mathematical equations directly from observed physical data. While traditional genetic programming (GP) methods struggle with exponential search spaces, **LLM-guided symbolic regression (LLM-SR)** utilizes physical priors.

- **Primary Sources:**
  - Shojaee, P., et al. (2024). *LLM-SR: Scientific Equation Discovery via Large Language Models.* **arXiv preprint** / OpenReview; [arXiv:2404.18400](https://arxiv.org/abs/2404.18400).
  - Udrescu, S. M., & Tegmark, M. (2020/2024). *AI Feynman: A physics-inspired method for symbolic regression.* **Science Advances** / Extensions into Foundation Models.
- **Methodology:**
  - The LLM acts as an educated prior. Given the names of variables, unit dimensions, and raw data profiles, the LLM proposes structural equation skeletons (e.g., harmonic oscillations, power laws, exponential dampening) rather than generating random mathematical expression trees.
  - A deterministic numerical solver fits the constants.
  - The residuals and error terms are analyzed by the LLM in an agentic loop, guiding the search toward physically realistic formulas that respect dimensional analysis and conservation principles.
  - Validated on the **Feynman Lectures Physics Benchmarks**, rediscovering equations across gravitational mechanics, electromagnetism, and fluid thermodynamics.

---

### 6.2 Numerical PDE Solvers and the SciCode Benchmark
Simulating complex systems—aerodynamics, weather forecasting, plasma physics—requires solving Partial Differential Equations (PDEs).
- **Automated PDE Solver Generation (CodePDE):** Frameworks leverage code-generation LLMs to generate, debug, and optimize numerical simulation scripts using high-performance finite element and spectral libraries (e.g., FEniCS, Dedalus, OpenFOAM). Test-time self-debugging loops allow LLMs to fix mesh boundary condition errors, adjust time steps to avoid Courant-Friedrichs-Lewy (CFL) numerical instabilities, and ensure mass conservation.
- **The SciCode Benchmark:**
  - Published in July 2024 by researchers from MIT, Harvard, and UC Berkeley: *SciCode: A Research-Level Competitive Programming Benchmark for Scientific Computing* ([arXiv:2407.02299](https://arxiv.org/abs/2407.02299)).
  - Evaluates models on 80 research-grade scientific computing problems decomposed into 338 subproblems spanning physics, chemistry, materials, and biology.
  - Highlights the current frontier: while frontier LLMs solve simple algorithmic problems easily, synthesizing coupled multi-physics numerical solvers requires multi-turn code execution and interactive tool feedback.

---

## 7. "Doing the Most with LLMs": The Core Architectural Patterns

Across every breakthrough documented above, a set of recurring architectural design patterns separates frontier scientific LLM systems from simple conversational tools.

| Architectural Pattern | Core Mechanism | Primary Purpose | Exemplary Systems |
| :--- | :--- | :--- | :--- |
| **Pattern 1: The Formal Verifier / Compiler Loop** | LLM generates code or formal syntax; verified by an immutable compiler/kernel | Eliminates hallucinations; guarantees mathematical/syntactic validity | AlphaProof, AlphaGeometry, FunSearch |
| **Pattern 2: Evolutionary Program Search** | LLM acts as a semantic mutation operator over a population of executable programs | Navigates combinatorial search spaces; discovers new algorithms | FunSearch, Eureka, DrEureka, EvoPrompt |
| **Pattern 3: Robotic APIs & Digital Twins** | LLM translates natural language into hardware scripts tested first in simulation | Bridges digital semantic reasoning and physical execution in wet labs | Coscientist, A-Lab, ChemCrow, DrEureka |
| **Pattern 4: MCTS in Formal Latent Spaces** | Monte Carlo Tree Search coupled with neural value/policy networks in formal syntax | Long-horizon tactical reasoning and strategic problem decomposition | AlphaProof, AlphaGeometry 2, Chem-Reasoner |
| **Pattern 5: Multi-Agent Peer Review & Refactoring** | Multi-agent pipelines dividing labor across ideation, execution, writing, and review | Enables fully autonomous, self-correcting end-to-end scientific cycles | The AI Scientist, FutureHouse Kosmos, WikiCrow |

---

### Pattern 1: LLM + Formal Verifier / Compiler Closed Loops
The foundational vulnerability of language models is statistical confabulation: predicting tokens based on probability rather than logical truth. In frontier scientific AI, **the LLM is never trusted as an authority**. Instead, the LLM is treated as an idea generator, and all outputs are passed directly into a deterministic compiler or formal verification kernel:
- **Lean 4 Kernel in AlphaProof:** Every intermediate proof step (tactic) must pass Lean’s kernel type-checker. If a step is invalid, the compiler immediately rejects it and returns the error trace.
- **Python REPL in ChemCrow & Coscientist:** Calculated molarities and stoichiometry equations are evaluated in a verified Python execution sandbox.
- **DFT & XRD Engines in Materials Science:** Crystal predictions are validated through quantum mechanical energy calculations (VASP/DFT) and experimental diffraction patterns.

### Pattern 2: LLM + Evolutionary Program Search
In complex optimization tasks (e.g., extremal combinatorics or robotic reward design), prompting an LLM in a single shot fails. Instead, systems use **Evolutionary Program Search**:
1. An initial population of executable code snippets is scored.
2. The LLM is provided with prompts containing several high-performing programs sampled from diverse clusters ("islands").
3. The LLM is prompted to cross-breed or mutate their computational logic.
4. The generated program is compiled and evaluated in parallel.
5. If the program achieves a higher score or introduces novel algorithmic diversity, it is stored in the prompt database.
This framework (used in *FunSearch* and *Eureka*) produces solutions that human engineers cannot replicate, because the LLM can execute hundreds of creative mutations while the evaluator guarantees objective optimization.

### Pattern 3: Robotic APIs & Digital Twins
To interact with the physical world safely, scientific agents do not send raw electrical signals to motors. They write high-level code against standardized robotic APIs (e.g., Opentrons Python API, PyLab, Robot Operating System / ROS):
- **Simulation Validation:** In DrEureka, robotic control policies are tested millions of times in GPU-accelerated Isaac Gym physics simulations before a single command reaches the physical robot arm or quadruped.
- **Deck Configuration Checks:** In Coscientist, the agent inspects the digital twin of the liquid handler's deck layout (ensuring tip boxes, 96-well plates, and solvent reservoirs are indexed correctly) prior to execution.

### Pattern 4: Monte Carlo Tree Search (MCTS) in Hypothesis Spaces
For long-horizon mathematical proofs or multi-step organic synthesis, greedy next-token prediction inevitably leads into dead ends. Frontier architectures embed the language model into an MCTS loop:
- The LLM acts as the **policy network**, generating the top-$k$ most promising next steps (proof tactics, retrosynthetic disconnections, or experimental branches).
- A **value model** (or simulated rollout) estimates the probability that a branch will successfully close the objective.
- The tree search balances exploration of speculative hypotheses with exploitation of high-confidence trajectories.

### Pattern 5: Multi-Agent Specialization & Autonomous Peer Review
By separating scientific workflows into distinct sub-agents with specialized system prompts and restricted tools, systems avoid catastrophic forgetting and maintain deep context:
- *Agent A (Ideation):* Scrapes arXiv and queries vector databases for open research questions.
- *Agent B (Bioinformatician/Coder):* Writes data ingestion and visualization code.
- *Agent C (Red-Teamer / Safety Auditor):* Scans candidate chemicals for biological weapons compliance or toxic precursors.
- *Agent D (Peer Reviewer):* Evaluates the completed manuscript against rigorous academic rubrics, forcing Agent B to rerun experiments or perform ablation studies if claims lack statistical backing.

---

## 8. Epistemic Risks, Dual-Use Hazards, and the Frontier Ahead

While autonomous scientific AI unlocks unprecedented acceleration for clean energy, mathematics, and medicine, it introduces critical systemic risks that require urgent governance and technical guardrails.

### 8.1 Dual-Use Chemical and Biological Hazards
Autonomous laboratories like Coscientist and generative protein models like ESM3 significantly lower the technical barrier to synthesizing dangerous substances:
- **Autonomous Chemical Weapon Synthesis:** In Coscientist's published safety evaluation, unmodified GPT-4 models were able to search for and produce viable synthesis protocols for dangerous chemical agents (including organophosphates and toxic blister agents).
- **Pathogen & Toxin Engineering:** Generative models capable of designing functional proteins can theoretically design novel biological toxins or immune-evasive viral capsids.
- **Mandatory Guardrails:** Frontier systems must integrate non-bypassable hardware interlocks: automated screening of DNA/RNA synthesis orders (as established by the International Gene Synthesis Consortium), real-time CAS-number lookup against prohibited chemical registries, and air-gapped hardware controllers that prevent unauthorized execution of hazardous protocols.

### 8.2 Scientific Hallucination & Synthetic Paper Contamination
The proliferation of sub-\$15 automated research systems (like *The AI Scientist*) raises the risk of flooding preprint servers and peer-reviewed journals with synthetic, superficially plausible, but scientifically vacuous "slop." 
- **The Epistemic Defense:** Automated paper generation is only scientifically meaningful when grounded in **reproducible, open-source code and verifiable experimental data**. Future peer review must rely increasingly on automated verification engines that re-run experimental code in isolated containers and test mathematical proofs against Lean kernels before publication.

### 8.3 The Future: Toward Self-Evolving Discovery Engines
The frontier of scientific AI is moving toward **recursive self-improvement in formal domains**:
1. *Active Discovery Engines:* Autonomous labs operating 24/7 across materials science, exploring thousands of crystal structures per month.
2. *Unified World Models:* Integrating diffusion-based structural biology (AlphaFold 3) directly with molecular dynamics engines to simulate whole-cell biochemistry.
3. *Autonomous Mathematical Exploration:* Systems like AlphaProof scaling from solving high-school Olympiad problems to verifying and formalizing cutting-edge conjectures in algebraic topology, number theory, and mathematical physics.

---

## 9. Primary Source Compendium

The following table provides verified citations, venues, identifiers, and direct links to the primary literature underpinning this report:

| Project / System | Primary Focus | Authors / Institution | Publication Venue & Date | Primary Identifier / Link |
| :--- | :--- | :--- | :--- | :--- |
| **Coscientist** | Autonomous chemical research & liquid handling | D. A. Boiko, R. MacKnight, B. Kline, G. dos Passos Gomes (CMU) | **Nature** (Dec 2023) | [DOI: 10.1038/s41586-023-06792-0](https://doi.org/10.1038/s41586-023-06792-0) |
| **A-Lab** | Autonomous solid-state crystal synthesis | N. J. Szymanski, B. Rendy, G. Ceder, et al. (UC Berkeley / LBNL) | **Nature** (Nov 2023) | [DOI: 10.1038/s41586-023-06734-w](https://doi.org/10.1038/s41586-023-06734-w) |
| **GNoME** | Scaling deep learning for materials discovery | A. Merchant, S. Batzner, E. D. Cubuk, et al. (Google DeepMind) | **Nature** (Nov 2023) | [DOI: 10.1038/s41586-023-06735-9](https://doi.org/10.1038/s41586-023-06735-9) |
| **ChemCrow** | Chemistry tool-augmented LLM agent | A. M. Bran, S. Cox, A. D. White, P. Schwaller, et al. (EPFL / FutureHouse) | **Nature Machine Intelligence** (May 2024) | [DOI: 10.1038/s42256-024-00832-8](https://doi.org/10.1038/s42256-024-00832-8) / [arXiv:2304.05376](https://arxiv.org/abs/2304.05376) |
| **FunSearch** | Mathematical discovery via function search | B. Romera-Paredes, J. S. Ellenberg, P. Kohli, A. Fawzi, et al. (Google DeepMind) | **Nature** (Jan 2024) | [DOI: 10.1038/s41586-023-06924-6](https://doi.org/10.1038/s41586-023-06924-6) |
| **AlphaGeometry** | Olympiad-level geometry without human data | T. H. Trinh, Y. Wu, Q. V. Le, H. He, T. Luong (Google DeepMind) | **Nature** (Jan 2024) | [DOI: 10.1038/s41586-023-06747-5](https://doi.org/10.1038/s41586-023-06747-5) |
| **AlphaProof & AlphaGeometry 2** | IMO 2024 Silver Medal formal theorem proving | Google DeepMind Research Team | Milestone Release (July 2024) | [DeepMind IMO Release](https://deepmind.google/discover/blog/ai-solves-imo-problems-at-silver-medal-level/) |
| **The AI Scientist** | End-to-end automated scientific discovery | C. Lu, C. Lu, R. T. Lange, J. Foerster, J. Clune, D. Ha (Sakana AI / Oxford / UBC) | **arXiv preprint** (Aug 2024) | [arXiv:2408.06292](https://arxiv.org/abs/2408.06292) |
| **PaperQA2** | Superhuman scientific literature synthesis | A. D. White, S. Rodriques, et al. (FutureHouse) | **arXiv preprint** (Sep 2024) | [arXiv:2409.13740](https://arxiv.org/abs/2409.13740) |
| **ESM3** | Multimodal generative biology & 500M yr evolution | T. Hayes, R. Rao, A. Rives, et al. (EvolutionaryScale) | **bioRxiv preprint** (July 2024) | [bioRxiv:2024.07.01.601570](https://www.biorxiv.org/content/10.1101/2024.07.01.601570v1) |
| **OpenCRISPR-1** | De novo AI-designed functional CRISPR editors | J. A. Ruffolo, P. Sulser, et al. (Profluent) | **bioRxiv / Nature** (Apr 2024) | [bioRxiv:2024.04.22.590591](https://www.biorxiv.org/content/10.1101/2024.04.22.590591v1) |
| **AlphaFold 3** | Biomolecular interactome structure prediction | J. Abramson, J. Jumper, D. Hassabis, et al. (DeepMind / Isomorphic Labs) | **Nature** (May 2024) | [DOI: 10.1038/s41586-024-07487-w](https://doi.org/10.1038/s41586-024-07487-w) |
| **Eureka** | Coding LLMs for robotic reward design | Y. J. Ma, L. Fan, A. Anandkumar, et al. (NVIDIA / UPenn / Caltech) | **ICLR 2024 Oral** (Oct 2023 / May 2024) | [arXiv:2310.12931](https://arxiv.org/abs/2310.12931) |
| **DrEureka** | Sim-to-real transfer via LLM physics tuning | Y. J. Ma, W. Liang, L. Fan, D. Jayaraman, et al. (UPenn / NVIDIA) | **RSS 2024** (June 2024) | [arXiv:2406.01967](https://arxiv.org/abs/2406.01967) |
| **SciCode** | Research-level scientific computing benchmark | M. Jiang, et al. (MIT / Harvard / UC Berkeley) | **arXiv preprint** (July 2024) | [arXiv:2407.02299](https://arxiv.org/abs/2407.02299) |
| **LLM-SR** | Scientific equation discovery via LLMs | P. Shojaee, et al. | **arXiv preprint / OpenReview** (Apr 2024) | [arXiv:2404.18400](https://arxiv.org/abs/2404.18400) |
