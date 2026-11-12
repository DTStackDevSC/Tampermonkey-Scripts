using System.Windows;
using System.Windows.Controls;
using System.Windows.Controls.Primitives;
using System.Windows.Media;
using System.Windows.Media.Imaging;
using ConfigEditor.ViewModels;

namespace ConfigEditor.App.Views;

/// <summary>The visual Feature Guide. Mocks use fixed light colors so they read like screenshots in both themes.</summary>
public sealed class HelpWindow : Window
{
    static readonly Brush Accent = Hex("#667eea");
    static readonly Brush AccentSoft = Hex("#eef0ff");
    static readonly Brush MockBg = Hex("#ffffff");
    static readonly Brush MockLine = Hex("#d6d9e6");
    static readonly Brush MockText = Hex("#333333");
    static readonly Brush MockHint = Hex("#777777");
    static readonly Brush ThGroup = Hex("#0b6bcb");
    static readonly Brush TbGroup = Hex("#764ba2");

    readonly HelpGuide guide;
    readonly StackPanel content = new();
    readonly Dictionary<string, Expander> cards = new();

    public HelpWindow(HelpGuide guide)
    {
        this.guide = guide;
        Title = "Config Editor: Feature Guide";
        Width = 860; Height = 760; MinWidth = 640; MinHeight = 480;
        WindowStartupLocation = WindowStartupLocation.CenterOwner;
        try { Icon = BitmapFrame.Create(new Uri("pack://application:,,,/app.ico")); } catch { }

        var root = new DockPanel { Margin = new Thickness(20, 16, 20, 16) };
        root.Children.Add(Docked(Header(), Dock.Top));
        root.Children.Add(Docked(JumpRow(), Dock.Top));
        var close = new Button { Content = "Close", IsCancel = true, MinWidth = 110, HorizontalAlignment = HorizontalAlignment.Right, Margin = new Thickness(0, 12, 0, 0) };
        close.Click += (_, _) => Close();
        root.Children.Add(Docked(close, Dock.Bottom));
        root.Children.Add(new ScrollViewer { Content = content, VerticalScrollBarVisibility = ScrollBarVisibility.Auto, Padding = new Thickness(0, 0, 8, 0) });
        Content = root;

        Card("start", "🚀", "Getting started", GettingStarted);
        Card("window", "🧭", "The window", TheWindow);
        Card("sections", "📚", "What each section changes", Sections);
        Card("teams", "👥", "Teams", Teams);
        Card("lists", "📋", "Editing lists", Lists);
        Card("texts", "💬", "Reply texts and placeholders", Texts);
        Card("save", "💾", "Save and upload", SaveAndUpload);
        Card("publish", "🚀", "Publish from the app (optional)", Publish);
        Card("tips", "🛟", "Good to know", Tips);
    }

    // ---------- layout ----------

    UIElement Header()
    {
        var row = new DockPanel { Margin = new Thickness(0, 0, 0, 10) };
        var icon = new Image { Width = 40, Height = 40, Margin = new Thickness(0, 0, 12, 0) };
        try { icon.Source = BitmapFrame.Create(new Uri("pack://application:,,,/app.ico")); } catch { }
        row.Children.Add(Docked(icon, Dock.Left));
        var titles = new StackPanel { VerticalAlignment = VerticalAlignment.Center };
        titles.Children.Add(new TextBlock { Text = "📖 Feature Guide", FontSize = 20, FontWeight = FontWeights.SemiBold });
        titles.Children.Add(Hint($"Config Editor • v{guide.Version} • edit the suites' texts and lists without touching code"));
        row.Children.Add(titles);
        return new Border { Child = row, BorderBrush = Accent, BorderThickness = new Thickness(0, 0, 0, 2), Padding = new Thickness(0, 0, 0, 10), Margin = new Thickness(0, 0, 0, 10) };
    }

    UIElement JumpRow()
    {
        var wrap = new WrapPanel { Margin = new Thickness(0, 0, 0, 10) };
        foreach (var (id, label) in new[] { ("start", "🚀 Start"), ("window", "🧭 Window"), ("sections", "📚 Sections"), ("teams", "👥 Teams"),
                     ("lists", "📋 Lists"), ("texts", "💬 Texts"), ("save", "💾 Save"), ("publish", "🚀 Publish"), ("tips", "🛟 Tips") })
        {
            var b = new Button { Content = label, Margin = new Thickness(0, 0, 6, 6), Padding = new Thickness(10, 3, 10, 3), Cursor = System.Windows.Input.Cursors.Hand, ToolTip = "Jump to this part" };
            b.Click += (_, _) => { var c = cards[id]; c.IsExpanded = true; c.BringIntoView(new Rect(0, 0, 1, c.ActualHeight)); };
            wrap.Children.Add(b);
        }
        return wrap;
    }

    void Card(string id, string icon, string title, Action<StackPanel> build)
    {
        var body = new StackPanel { Margin = new Thickness(14, 8, 14, 12) };
        build(body);
        var exp = new Expander
        {
            Header = new TextBlock { Text = $"{icon}  {title}", FontSize = 15, FontWeight = FontWeights.SemiBold },
            Content = body, IsExpanded = true, Margin = new Thickness(0, 0, 0, 10), Padding = new Thickness(4)
        };
        cards[id] = exp;
        var frame = new Border { Child = exp, CornerRadius = new CornerRadius(8), BorderThickness = new Thickness(1), Margin = new Thickness(0, 0, 0, 10) };
        frame.SetResourceReference(Border.BorderBrushProperty, "ControlStrokeColorDefaultBrush");
        frame.SetResourceReference(Border.BackgroundProperty, "CardBackgroundFillColorDefaultBrush");
        content.Children.Add(frame);
    }

    // ---------- sections ----------

    void GettingStarted(StackPanel b)
    {
        Lead(b, "Four steps take a change from this window to everyone's Tampermonkey.");
        var flow = new WrapPanel();
        var steps = new[] { ("⟳", "Open latest", "Scripts come from GitHub"), ("📚", "Pick a section", "Menu on the left"),
                            ("✏️", "Edit", "Texts, lists, teams"), ("💾", "Save", "Writes the updated files"), ("⬆️", "Upload", "On the GitHub page") };
        for (var i = 0; i < steps.Length; i++)
        {
            flow.Children.Add(StepTile(i + 1, steps[i].Item1, steps[i].Item2, steps[i].Item3));
            if (i < steps.Length - 1) flow.Children.Add(new TextBlock { Text = "➜", FontSize = 18, Foreground = Accent, VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(4, 0, 4, 0) });
        }
        b.Children.Add(flow);
        Bullets(b,
            "The app downloads the newest scripts from GitHub when it starts, so you always edit the current version.",
            "Nothing reaches your colleagues until the files are uploaded. Until then you can edit freely.",
            "After the upload, Tampermonkey offers the update to everyone. The version number and the What's new list are filled in for you.");
    }

    void TheWindow(StackPanel b)
    {
        Lead(b, "Four areas, numbered as in this picture.");
        var win = new Grid { Width = 560, HorizontalAlignment = HorizontalAlignment.Left };
        win.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        win.RowDefinitions.Add(new RowDefinition { Height = new GridLength(150) });
        win.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
        win.ColumnDefinitions.Add(new ColumnDefinition { Width = new GridLength(150) });
        win.ColumnDefinitions.Add(new ColumnDefinition());

        var top = new DockPanel { Background = Hex("#f6f7fb") };
        var tb = MockRow(MockButton("⟳ Open latest"), MockButton("📁 Open folder"), MockButton("⚙ Settings"), MockButton("? Help", Accent), Num(1));
        top.Children.Add(Docked(tb, Dock.Right));
        top.Children.Add(new TextBlock { Text = "Config Editor", FontWeight = FontWeights.SemiBold, Foreground = MockText, Margin = new Thickness(8, 6, 0, 6), VerticalAlignment = VerticalAlignment.Center });
        Place(win, Boxed(top, new Thickness(0, 0, 0, 1)), 0, 0, 2);

        var nav = new StackPanel { Background = MockBg, Margin = new Thickness(0) };
        nav.Children.Add(MockRow(Num(2)));
        nav.Children.Add(MockSmall("Ticket Helpers", true));
        nav.Children.Add(MockNav("Short Description", false));
        nav.Children.Add(MockNav("Ticket Response", true));
        nav.Children.Add(MockNav("Policy Naming", false));
        nav.Children.Add(MockSmall("Tools Toolbar", true));
        nav.Children.Add(MockNav("Change Tracker note texts", false));
        Place(win, Boxed(nav, new Thickness(0, 0, 1, 0)), 1, 0);

        var page = new StackPanel { Background = MockBg, Margin = new Thickness(10, 6, 10, 6) };
        page.Children.Add(MockRow(Num(3), MockSmall("Team", false), MockCombo("EMEA Team"), MockButton("＋ Add team")));
        page.Children.Add(new TextBlock { Text = "Ticket Response", FontSize = 14, FontWeight = FontWeights.SemiBold, Foreground = MockText, Margin = new Thickness(0, 6, 0, 4) });
        page.Children.Add(MockLines(3));
        Place(win, page, 1, 1);

        var bottom = new DockPanel { Background = Hex("#f6f7fb") };
        bottom.Children.Add(Docked(MockRow(Num(4), MockButton("💾 Save", Accent)), Dock.Right));
        bottom.Children.Add(new TextBlock { Text = "1 section changed", FontWeight = FontWeights.SemiBold, Foreground = MockText, Margin = new Thickness(8, 6, 0, 6), VerticalAlignment = VerticalAlignment.Center });
        Place(win, Boxed(bottom, new Thickness(0, 1, 0, 0)), 2, 0, 2);

        b.Children.Add(new Border { Child = win, BorderBrush = MockLine, BorderThickness = new Thickness(1), CornerRadius = new CornerRadius(6), HorizontalAlignment = HorizontalAlignment.Left, Margin = new Thickness(0, 0, 0, 10), ClipToBounds = true });
        Legend(b,
            ("1", "Top bar: reload the scripts from GitHub, work on a folder instead, settings and this guide."),
            ("2", "Sections, grouped by suite. A greyed one could not be read: point at it to see why."),
            ("3", "The section you edit. Sections that differ per team show the team picker on top."),
            ("4", "How many sections you changed, the status of the last action and the Save button."));
    }

    void Sections(StackPanel b)
    {
        Lead(b, "Each section edits one part of a suite. This is what changes for your colleagues.");
        foreach (var s in guide.Sections)
        {
            var card = new StackPanel();
            var head = new WrapPanel();
            head.Children.Add(new TextBlock { Text = s.Icon, FontSize = 18, Margin = new Thickness(0, 0, 8, 0), VerticalAlignment = VerticalAlignment.Center });
            head.Children.Add(new TextBlock { Text = s.Title, FontSize = 14, FontWeight = FontWeights.SemiBold, Foreground = MockText, VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(0, 0, 10, 0) });
            head.Children.Add(Chip(s.Group, s.Group == "Tools Toolbar" ? TbGroup : ThGroup));
            if (s.PerTeam) head.Children.Add(Chip("👥 Per team", Hex("#2a7d4f")));
            card.Children.Add(head);
            card.Children.Add(new TextBlock { Text = s.Changes, TextWrapping = TextWrapping.Wrap, Foreground = MockText, Margin = new Thickness(0, 6, 0, 4) });
            card.Children.Add(new TextBlock { Text = "📍 " + s.WhereUsersSeeIt, TextWrapping = TextWrapping.Wrap, Foreground = MockHint, FontSize = 12, Margin = new Thickness(0, 0, 0, 6) });
            var parts = new WrapPanel();
            foreach (var p in s.Parts) parts.Children.Add(Chip(p, AccentSoft, MockText, "#c0c8f0"));
            card.Children.Add(parts);
            b.Children.Add(new Border { Child = card, Background = MockBg, BorderBrush = MockLine, BorderThickness = new Thickness(1), CornerRadius = new CornerRadius(6), Padding = new Thickness(12, 10, 12, 10), Margin = new Thickness(0, 0, 0, 8) });
        }
    }

    void Teams(StackPanel b)
    {
        Lead(b, "Sections marked 👥 Per team are edited one team at a time.");
        b.Children.Add(MockPanel(MockRow(MockSmall("Team", false), MockCombo("EMEA Team"), MockButton("＋ Add team"), MockButton("🗑 Delete team"))));
        Legend(b,
            ("▾", "Pick the team to edit. Your edits to the other teams are kept."),
            ("＋", "Creates a team in every helper at once, copied from a team you choose, so it starts with working texts."),
            ("🗑", "Removes the team from every helper. The button turns into \"Click again to delete\" first."));
    }

    void Lists(StackPanel b)
    {
        Lead(b, "Lists look like a small spreadsheet: select a row, then use the buttons above it.");
        var table = new Grid { Width = 380, HorizontalAlignment = HorizontalAlignment.Left, Margin = new Thickness(0, 6, 0, 0) };
        table.ColumnDefinitions.Add(new ColumnDefinition()); table.ColumnDefinitions.Add(new ColumnDefinition());
        var rows = new[] { ("Shown as", "Stored value", true, false), ("Spain", "ES", false, false), ("Germany", "DE", false, true), ("France", "FR", false, false) };
        for (var r = 0; r < rows.Length; r++)
        {
            table.RowDefinitions.Add(new RowDefinition());
            var (a, c, isHead, sel) = rows[r];
            var bg = isHead ? Hex("#f6f7fb") : sel ? AccentSoft : MockBg;
            Place(table, Cell(a, bg, isHead), r, 0);
            Place(table, Cell(c, bg, isHead), r, 1);
        }
        var panel = new StackPanel();
        panel.Children.Add(MockRow(MockButton("＋ Add"), MockButton("📄 Copy"), MockButton("⬆"), MockButton("⬇"), MockButton("🗑 Remove")));
        panel.Children.Add(table);
        b.Children.Add(MockPanel(panel));
        Legend(b,
            ("＋", "Adds a row below the selected one. 📄 Copy duplicates the selected row."),
            ("⬆⬇", "Move the selected row. The order here is the order in the dropdown."),
            ("🗑", "Removes the selected row. The button turns into \"Click again to remove\" first."),
            ("✎", "Click a cell to change it. Shown as is what users read, Stored value is the code the script writes."));
    }

    void Texts(StackPanel b)
    {
        Lead(b, "Reply texts are plain text. Placeholders are filled in for each ticket.");
        var box = new StackPanel();
        var text = new Border { BorderBrush = MockLine, BorderThickness = new Thickness(1), CornerRadius = new CornerRadius(4), Background = MockBg, Padding = new Thickness(8, 6, 8, 6), Width = 380, HorizontalAlignment = HorizontalAlignment.Left };
        text.Child = new TextBlock { Text = "Hello {▌", FontFamily = new FontFamily("Consolas"), Foreground = MockText };
        box.Children.Add(text);
        var pop = new StackPanel();
        pop.Children.Add(new TextBlock { Text = "Insert a placeholder", FontSize = 11, Foreground = MockHint, Margin = new Thickness(0, 0, 0, 4) });
        pop.Children.Add(Cell("{Opened by name}", AccentSoft, false));
        pop.Children.Add(Cell("{Ticket type}", MockBg, false));
        box.Children.Add(new Border { Child = pop, Background = MockBg, BorderBrush = MockLine, BorderThickness = new Thickness(1), CornerRadius = new CornerRadius(6), Padding = new Thickness(6), Width = 200, HorizontalAlignment = HorizontalAlignment.Left, Margin = new Thickness(56, 2, 0, 0), Effect = new System.Windows.Media.Effects.DropShadowEffect { BlurRadius = 8, ShadowDepth = 2, Opacity = 0.25 } });
        b.Children.Add(MockPanel(box));
        b.Children.Add(BeforeAfter("Template", "Hello {Opened by name}, your {Ticket type} is done.", "Inserted", "Hello Jane, your Request is done."));
        Bullets(b,
            "Type { in the text to open the placeholder list, then pick one with the mouse or Enter.",
            "👀 Preview under the text shows the reply as it would be inserted for Jane Doe on a Request.",
            "Writes into chooses Comments (the requester sees it) or Work notes (internal only).");
    }

    void SaveAndUpload(StackPanel b)
    {
        Lead(b, "Save writes the updated scripts to a folder on your PC. Then you upload them on GitHub.");
        var dialog = new StackPanel();
        dialog.Children.Add(new TextBlock { Text = "Save changes", FontWeight = FontWeights.SemiBold, Foreground = MockText, Margin = new Thickness(0, 0, 0, 4) });
        dialog.Children.Add(new TextBlock { Text = "What's new (shown to users in the changelog). You can reword each line:", TextWrapping = TextWrapping.Wrap, FontSize = 11, Foreground = MockHint, Margin = new Thickness(0, 0, 0, 4) });
        var line = new Border { BorderBrush = MockLine, BorderThickness = new Thickness(1), CornerRadius = new CornerRadius(4), Padding = new Thickness(6, 3, 6, 3), Margin = new Thickness(0, 0, 0, 6) };
        line.Child = new TextBlock { Text = "Ticket Response Helper: Updated the EMEA Team replies.", TextWrapping = TextWrapping.Wrap, Foreground = MockText, FontSize = 12 };
        dialog.Children.Add(line);
        dialog.Children.Add(MockRow(MockButton("💾 Save", Accent), MockButton("Close")));
        var result = new StackPanel();
        result.Children.Add(new TextBlock { Text = "✅ Saved. Now upload them on GitHub.", TextWrapping = TextWrapping.Wrap, Foreground = MockText, FontWeight = FontWeights.SemiBold, Margin = new Thickness(0, 0, 0, 6) });
        result.Children.Add(MockButton("Upload to Standalone Scripts"));
        result.Children.Add(new Border { Height = 4 });
        result.Children.Add(MockButton("Open the saved folder"));
        var github = new StackPanel();
        github.Children.Add(new TextBlock { Text = "GitHub upload page", FontWeight = FontWeights.SemiBold, Foreground = MockText, Margin = new Thickness(0, 0, 0, 6) });
        github.Children.Add(new Border { BorderBrush = MockLine, BorderThickness = new Thickness(1.5), CornerRadius = new CornerRadius(6), Padding = new Thickness(10, 14, 10, 14), Margin = new Thickness(0, 0, 0, 6),
            Child = new TextBlock { Text = "⬇ Drag the files here", Foreground = MockHint, HorizontalAlignment = HorizontalAlignment.Center } });
        github.Children.Add(MockButton("Commit changes", Hex("#1f883d")));
        var flow = new WrapPanel();
        flow.Children.Add(Sized(MockPanel(dialog), 270));
        flow.Children.Add(Arrow());
        flow.Children.Add(Sized(MockPanel(result), 230));
        flow.Children.Add(Arrow());
        flow.Children.Add(Sized(MockPanel(github), 190));
        b.Children.Add(flow);
        Bullets(b,
            "Check the What's new lines: your colleagues read them in the script's changelog.",
            "The version number goes up by itself in every place the script needs it.",
            "Each upload link opens the right GitHub folder. Drag the saved file in and press Commit changes.",
            "The first time, the app reminds you to keep your email private on GitHub, because the repository is public.");
    }

    void Publish(StackPanel b)
    {
        Lead(b, "Optional: let the app upload for you, so Save and upload become one click.");
        var settings = new StackPanel();
        settings.Children.Add(MockToggle("Publish to GitHub from this app", true));
        settings.Children.Add(new TextBlock { Text = "GitHub token", FontWeight = FontWeights.SemiBold, Foreground = MockText, Margin = new Thickness(0, 8, 0, 4) });
        settings.Children.Add(MockRow(new Border { Width = 200, Height = 24, BorderBrush = MockLine, BorderThickness = new Thickness(1), CornerRadius = new CornerRadius(4), Child = new TextBlock { Text = "••••••••••••••", Foreground = MockHint, Margin = new Thickness(6, 3, 0, 0) } }, MockButton("🔑 Test token")));
        var flow = new WrapPanel();
        flow.Children.Add(Sized(MockPanel(settings), 330));
        flow.Children.Add(Arrow());
        flow.Children.Add(MockPanel(MockRow(MockButton("🚀 Publish"), MockButton("💾 Save", Accent))));
        b.Children.Add(flow);
        Legend(b,
            ("⚙", "Turn it on in ⚙ Settings and paste a GitHub fine grained token with Contents: Read and write on the repository."),
            ("🔑", "Test token checks it right away. It is stored encrypted for your Windows user only."),
            ("🚀", "A Publish button appears next to Save. It shows the same What's new lines, then commits the files for you."));
        b.Children.Add(Hint(guide.PublishEnabled ? "✅ Publishing is on for you." : "ℹ️ Publishing is off for you: Save and upload on the GitHub page."));
    }

    void Tips(StackPanel b)
    {
        Lead(b, "What the messages mean and what to do.");
        Legend(b,
            ("⚠️", "\"Someone changed ... on GitHub since you opened it\": nothing was saved. Note your edits, press ⟳ Open latest and redo them."),
            ("🚫", "A greyed section could not be read in this version of the script. Point at it to see why."),
            ("📁", "Open folder works on scripts saved on your PC, for example when GitHub cannot be reached."),
            ("✖", "Closing with unsaved edits asks you first, so nothing is lost by accident."),
            ("⏳", "While the app works, the busy part is covered by a wheel with a short note of what is happening."));
    }

    // ---------- helpers ----------

    static Brush Hex(string c) { var b = (Brush)new BrushConverter().ConvertFromString(c)!; b.Freeze(); return b; }
    static T Docked<T>(T e, Dock d) where T : UIElement { DockPanel.SetDock(e, d); return e; }
    static void Place(Grid g, UIElement e, int row, int col, int span = 1) { Grid.SetRow(e, row); Grid.SetColumn(e, col); Grid.SetColumnSpan(e, span); g.Children.Add(e); }

    static TextBlock Hint(string text)
    {
        var t = new TextBlock { Text = text, TextWrapping = TextWrapping.Wrap, FontSize = 12, Margin = new Thickness(0, 4, 0, 0) };
        t.SetResourceReference(TextBlock.ForegroundProperty, "TextFillColorSecondaryBrush");
        return t;
    }

    static void Lead(StackPanel b, string text) => b.Children.Add(new TextBlock { Text = text, TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0, 0, 0, 10) });

    static void Bullets(StackPanel b, params string[] items)
    {
        var list = new StackPanel { Margin = new Thickness(0, 8, 0, 0) };
        foreach (var i in items)
        {
            var row = new DockPanel { Margin = new Thickness(0, 2, 0, 2) };
            row.Children.Add(Docked(new TextBlock { Text = "•", Foreground = Accent, FontWeight = FontWeights.Bold, Margin = new Thickness(0, 0, 8, 0) }, Dock.Left));
            row.Children.Add(new TextBlock { Text = i, TextWrapping = TextWrapping.Wrap });
            list.Children.Add(row);
        }
        b.Children.Add(list);
    }

    static void Legend(StackPanel b, params (string Key, string Text)[] items)
    {
        var grid = new Grid { Margin = new Thickness(0, 6, 0, 0) };
        grid.ColumnDefinitions.Add(new ColumnDefinition { Width = GridLength.Auto });
        grid.ColumnDefinitions.Add(new ColumnDefinition());
        for (var i = 0; i < items.Length; i++)
        {
            grid.RowDefinitions.Add(new RowDefinition { Height = GridLength.Auto });
            var key = new Border { Background = Accent, CornerRadius = new CornerRadius(10), MinWidth = 22, Height = 22, Padding = new Thickness(5, 0, 5, 0), Margin = new Thickness(0, 3, 10, 3), VerticalAlignment = VerticalAlignment.Top,
                Child = new TextBlock { Text = items[i].Key, Foreground = Brushes.White, FontWeight = FontWeights.Bold, FontSize = 11, HorizontalAlignment = HorizontalAlignment.Center, VerticalAlignment = VerticalAlignment.Center } };
            Place(grid, key, i, 0);
            Place(grid, new TextBlock { Text = items[i].Text, TextWrapping = TextWrapping.Wrap, Margin = new Thickness(0, 4, 0, 4) }, i, 1);
        }
        b.Children.Add(grid);
    }

    static Border StepTile(int n, string icon, string title, string sub)
    {
        var s = new StackPanel { HorizontalAlignment = HorizontalAlignment.Center };
        s.Children.Add(new TextBlock { Text = icon, FontSize = 22, HorizontalAlignment = HorizontalAlignment.Center });
        s.Children.Add(new TextBlock { Text = $"{n}. {title}", FontWeight = FontWeights.SemiBold, Foreground = MockText, HorizontalAlignment = HorizontalAlignment.Center, Margin = new Thickness(0, 4, 0, 2) });
        s.Children.Add(new TextBlock { Text = sub, FontSize = 11, Foreground = MockHint, TextAlignment = TextAlignment.Center, TextWrapping = TextWrapping.Wrap });
        return new Border { Child = s, Width = 118, Padding = new Thickness(8), Margin = new Thickness(0, 0, 0, 6), Background = AccentSoft, BorderBrush = Hex("#c0c8f0"), BorderThickness = new Thickness(1), CornerRadius = new CornerRadius(8) };
    }

    static TextBlock Arrow() => new() { Text = "➜", FontSize = 18, Foreground = Accent, VerticalAlignment = VerticalAlignment.Center, Margin = new Thickness(6, 0, 6, 0) };

    static FrameworkElement Sized(FrameworkElement e, double w) { e.Width = w; return e; }

    static Border MockPanel(UIElement child) => new()
    {
        Child = child, Background = MockBg, BorderBrush = MockLine, BorderThickness = new Thickness(1), CornerRadius = new CornerRadius(6),
        Padding = new Thickness(10), Margin = new Thickness(0, 0, 0, 6), HorizontalAlignment = HorizontalAlignment.Left, VerticalAlignment = VerticalAlignment.Top
    };

    static Border Boxed(UIElement child, Thickness border) => new() { Child = child, BorderBrush = MockLine, BorderThickness = border };

    static StackPanel MockRow(params FrameworkElement[] items)
    {
        var s = new StackPanel { Orientation = Orientation.Horizontal, Margin = new Thickness(4, 4, 4, 4) };
        foreach (var i in items) { i.Margin = new Thickness(0, 0, 5, 0); i.VerticalAlignment = VerticalAlignment.Center; s.Children.Add(i); }
        return s;
    }

    static Border MockButton(string text, Brush? fill = null) => new()
    {
        Background = fill ?? Hex("#f3f4f6"), BorderBrush = fill ?? MockLine, BorderThickness = new Thickness(1), CornerRadius = new CornerRadius(4),
        Padding = new Thickness(7, 2, 7, 3), HorizontalAlignment = HorizontalAlignment.Left,
        Child = new TextBlock { Text = text, FontSize = 11, Foreground = fill == null ? MockText : Brushes.White, FontWeight = fill == null ? FontWeights.Normal : FontWeights.SemiBold }
    };

    static Border MockCombo(string text) => new()
    {
        BorderBrush = MockLine, BorderThickness = new Thickness(1), CornerRadius = new CornerRadius(4), Background = MockBg, Padding = new Thickness(7, 2, 7, 3),
        Child = new TextBlock { Text = text + "   ▾", FontSize = 11, Foreground = MockText }
    };

    static TextBlock MockSmall(string text, bool heading) => new()
    {
        Text = text, FontSize = 11, FontWeight = FontWeights.Bold, Foreground = heading ? MockHint : MockText, Margin = new Thickness(8, heading ? 6 : 0, 0, 2)
    };

    static Border MockNav(string text, bool selected) => new()
    {
        Background = selected ? AccentSoft : MockBg, Margin = new Thickness(4, 0, 4, 0), CornerRadius = new CornerRadius(3), Padding = new Thickness(8, 2, 4, 2),
        BorderBrush = Accent, BorderThickness = new Thickness(selected ? 3 : 0, 0, 0, 0),
        Child = new TextBlock { Text = text, FontSize = 11, Foreground = MockText }
    };

    static StackPanel MockLines(int n)
    {
        var s = new StackPanel();
        for (var i = 0; i < n; i++) s.Children.Add(new Border { Height = 8, Width = 300 - i * 60, Background = Hex("#e6e8f2"), CornerRadius = new CornerRadius(3), Margin = new Thickness(0, 4, 0, 0), HorizontalAlignment = HorizontalAlignment.Left });
        return s;
    }

    static Border Num(int n) => new()
    {
        Width = 20, Height = 20, CornerRadius = new CornerRadius(10), Background = Hex("#ff8c00"),
        Child = new TextBlock { Text = n.ToString(), Foreground = Brushes.White, FontWeight = FontWeights.Bold, FontSize = 11, HorizontalAlignment = HorizontalAlignment.Center, VerticalAlignment = VerticalAlignment.Center }
    };

    static Border Chip(string text, Brush bg, Brush? fg = null, string? border = null) => new()
    {
        Background = bg, CornerRadius = new CornerRadius(4), Padding = new Thickness(7, 2, 7, 3), Margin = new Thickness(0, 0, 6, 4),
        BorderBrush = border == null ? null : Hex(border), BorderThickness = new Thickness(border == null ? 0 : 1),
        Child = new TextBlock { Text = text, FontSize = 11, FontWeight = FontWeights.SemiBold, Foreground = fg ?? Brushes.White }
    };

    static Border Cell(string text, Brush bg, bool head) => new()
    {
        Background = bg, BorderBrush = MockLine, BorderThickness = new Thickness(0, 0, 1, 1), Padding = new Thickness(6, 3, 6, 3),
        Child = new TextBlock { Text = text, FontSize = 12, Foreground = MockText, FontWeight = head ? FontWeights.SemiBold : FontWeights.Normal }
    };

    static StackPanel MockToggle(string label, bool on)
    {
        var track = new Border { Width = 34, Height = 18, CornerRadius = new CornerRadius(9), Background = on ? Accent : Hex("#c8c8c8") };
        track.Child = new Border { Width = 12, Height = 12, CornerRadius = new CornerRadius(6), Background = Brushes.White, HorizontalAlignment = on ? HorizontalAlignment.Right : HorizontalAlignment.Left, Margin = new Thickness(3, 0, 3, 0) };
        return MockRow(track, new TextBlock { Text = label, Foreground = MockText, FontSize = 12 });
    }

    static Border BeforeAfter(string l1, string t1, string l2, string t2)
    {
        var s = new StackPanel();
        foreach (var (label, text, bg, color, last) in new[] { (l1, t1, "#f8f8ff", "#888888", false), (l2, t2, "#f2fff7", "#2a7d4f", true) })
        {
            var row = new DockPanel { Background = Hex(bg) };
            row.Children.Add(Docked(new TextBlock { Text = label.ToUpperInvariant(), Width = 70, FontSize = 10, FontWeight = FontWeights.Bold, Foreground = Hex(color), Margin = new Thickness(10, 7, 0, 7) }, Dock.Left));
            row.Children.Add(new TextBlock { Text = text, FontFamily = new FontFamily("Consolas"), FontSize = 12, Foreground = MockText, Margin = new Thickness(0, 6, 10, 6), TextWrapping = TextWrapping.Wrap });
            s.Children.Add(new Border { Child = row, BorderBrush = MockLine, BorderThickness = new Thickness(0, 0, 0, last ? 0 : 1) });
        }
        return new Border { Child = s, BorderBrush = MockLine, BorderThickness = new Thickness(1), CornerRadius = new CornerRadius(6), Margin = new Thickness(0, 4, 0, 4), ClipToBounds = true, MaxWidth = 560, HorizontalAlignment = HorizontalAlignment.Left };
    }
}
