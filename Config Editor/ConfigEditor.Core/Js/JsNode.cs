using System.Text;

namespace ConfigEditor.Core.Js;

/// <summary>
/// A value from a JS config block. Nodes read from a file remember their source text, so an
/// unchanged node is written back byte for byte.
/// </summary>
public abstract class JsNode
{
    internal string? Origin;
    internal string? OriginKey;

    /// <summary>Comment lines written just above this node when it is an array item.</summary>
    public string? LeadingComment { get; set; }
    public bool BlankLineBefore { get; set; }
    /// <summary>Spaces before this item inside a one line array, as read (null for the first item or when unknown).</summary>
    public string? InlineGap { get; set; }

    /// <summary>Formatting independent fingerprint, used for deep equality.</summary>
    public string Canonical()
    {
        var sb = new StringBuilder();
        AppendCanonical(sb);
        return sb.ToString();
    }

    internal abstract void AppendCanonical(StringBuilder sb);

    public abstract JsNode Clone();

    protected T CopyBase<T>(T target) where T : JsNode
    {
        target.Origin = Origin;
        target.OriginKey = OriginKey;
        target.LeadingComment = LeadingComment;
        target.BlankLineBefore = BlankLineBefore;
        target.InlineGap = InlineGap;
        return target;
    }

    public static bool DeepEquals(JsNode? a, JsNode? b) =>
        a == null ? b == null : b != null && a.Canonical() == b.Canonical();

    internal static void Quote(StringBuilder sb, string s)
    {
        sb.Append('"');
        foreach (var c in s)
        {
            if (c == '"' || c == '\\') sb.Append('\\');
            sb.Append(c);
        }
        sb.Append('"');
    }
}

public sealed class JsProperty
{
    public JsProperty(string key, JsNode value) { Key = key; Value = value; }
    public string Key { get; set; }
    public JsNode Value { get; set; }
    public string? LeadingComment { get; set; }
    public bool BlankLineBefore { get; set; }
    public bool BlankLineAfterComment { get; set; }
    /// <summary>Spaces before this property inside a one line object, as read (null for the first one or when unknown).</summary>
    public string? InlineGap { get; set; }
    /// <summary>Spaces between the colon and the value, as read (aligned columns).</summary>
    public string? ValueGap { get; set; }
    /// <summary>The key was written in quotes in the source.</summary>
    public bool KeyQuoted { get; set; }

    public JsProperty Clone() => new(Key, Value.Clone())
    {
        LeadingComment = LeadingComment, BlankLineBefore = BlankLineBefore, BlankLineAfterComment = BlankLineAfterComment,
        InlineGap = InlineGap, ValueGap = ValueGap, KeyQuoted = KeyQuoted
    };
}

/// <summary>Layout remembered from the source so a rewritten container keeps its look.</summary>
public abstract class JsContainer : JsNode
{
    public bool? Inline { get; set; }
    public bool TrailingComma { get; set; }
    public string? ChildIndent { get; set; }
    public string? CloseIndent { get; set; }
    public string? TrailingComment { get; set; }
    public bool BlankLineBeforeClose { get; set; }
    /// <summary>A blank line separates the last item from the trailing comment.</summary>
    public bool BlankLineBeforeTrailingComment { get; set; }
    /// <summary>One line layout as read: spaces after the opening bracket, after each comma, and before the closing one.</summary>
    public string? OpenGap { get; set; }
    public string? SeparatorGap { get; set; }
    public string? CloseGap { get; set; }

    protected T CopyLayout<T>(T target) where T : JsContainer
    {
        CopyBase(target);
        target.Inline = Inline;
        target.TrailingComma = TrailingComma;
        target.ChildIndent = ChildIndent;
        target.CloseIndent = CloseIndent;
        target.TrailingComment = TrailingComment;
        target.BlankLineBeforeClose = BlankLineBeforeClose;
        target.BlankLineBeforeTrailingComment = BlankLineBeforeTrailingComment;
        target.OpenGap = OpenGap;
        target.SeparatorGap = SeparatorGap;
        target.CloseGap = CloseGap;
        return target;
    }
}

public sealed class JsObject : JsContainer
{
    public List<JsProperty> Props { get; } = new();

    public JsNode? this[string key]
    {
        get => Props.FirstOrDefault(p => p.Key == key)?.Value;
        set
        {
            var p = Props.FirstOrDefault(x => x.Key == key);
            if (value == null) { if (p != null) Props.Remove(p); return; }
            if (p == null) Props.Add(new JsProperty(key, value));
            else if (!DeepEquals(p.Value, value)) p.Value = value;
        }
    }

    public bool Has(string key) => Props.Any(p => p.Key == key);

    internal override void AppendCanonical(StringBuilder sb)
    {
        sb.Append('{');
        foreach (var p in Props)
        {
            if (p.LeadingComment != null) { sb.Append("/*"); Quote(sb, p.LeadingComment); sb.Append("*/"); }
            Quote(sb, p.Key);
            sb.Append(':');
            p.Value.AppendCanonical(sb);
            sb.Append(',');
        }
        if (TrailingComment != null) { sb.Append("/*"); Quote(sb, TrailingComment); sb.Append("*/"); }
        sb.Append('}');
    }

    public override JsNode Clone()
    {
        var o = CopyLayout(new JsObject());
        o.Props.AddRange(Props.Select(p => p.Clone()));
        return o;
    }
}

public sealed class JsArray : JsContainer
{
    public List<JsNode> Items { get; } = new();

    internal override void AppendCanonical(StringBuilder sb)
    {
        sb.Append('[');
        foreach (var i in Items)
        {
            if (i.LeadingComment != null) { sb.Append("/*"); Quote(sb, i.LeadingComment); sb.Append("*/"); }
            i.AppendCanonical(sb);
            sb.Append(',');
        }
        if (TrailingComment != null) { sb.Append("/*"); Quote(sb, TrailingComment); sb.Append("*/"); }
        sb.Append(']');
    }

    public override JsNode Clone()
    {
        var a = CopyLayout(new JsArray());
        a.Items.AddRange(Items.Select(i => i.Clone()));
        return a;
    }
}

public sealed class JsString : JsNode
{
    public JsString(string value) { Value = value; }
    public string Value { get; set; }
    internal override void AppendCanonical(StringBuilder sb) { sb.Append('s'); Quote(sb, Value); }
    public override JsNode Clone() => CopyBase(new JsString(Value));
}

public sealed class JsNumber : JsNode
{
    public JsNumber(string raw) { Raw = raw; }
    public string Raw { get; set; }
    internal override void AppendCanonical(StringBuilder sb) { sb.Append('n').Append(Raw); }
    public override JsNode Clone() => CopyBase(new JsNumber(Raw));
}

public sealed class JsBool : JsNode
{
    public JsBool(bool value) { Value = value; }
    public bool Value { get; set; }
    internal override void AppendCanonical(StringBuilder sb) { sb.Append(Value ? "true" : "false"); }
    public override JsNode Clone() => CopyBase(new JsBool(Value));
}

/// <summary>An arrow function returning a template literal: <c>(vars) =&gt; `...`</c>.</summary>
public sealed class JsTemplateFn : JsNode
{
    public JsTemplateFn(string param, string rawBody) { Param = param; RawBody = rawBody; }
    public string Param { get; set; }
    /// <summary>The text between the backticks, exactly as written in the file.</summary>
    public string RawBody { get; set; }
    internal override void AppendCanonical(StringBuilder sb) { sb.Append("fn"); Quote(sb, Param); Quote(sb, RawBody); }
    public override JsNode Clone() => CopyBase(new JsTemplateFn(Param, RawBody));
}

/// <summary>Any other expression, kept as source text.</summary>
public sealed class JsRaw : JsNode
{
    public JsRaw(string text) { Text = text; }
    public string Text { get; set; }
    internal override void AppendCanonical(StringBuilder sb) { sb.Append("raw"); Quote(sb, Text); }
    public override JsNode Clone() => CopyBase(new JsRaw(Text));
}
