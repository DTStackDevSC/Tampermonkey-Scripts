using Acornima;

namespace ConfigEditor.Core.Script;

public sealed record ValidationResult(bool Ok, int Line, int Column, string Message);

public static class JsValidator
{
    public static ValidationResult Check(string text)
    {
        try
        {
            new Parser(new ParserOptions { EcmaVersion = EcmaVersion.Latest }).ParseScript(text);
            return new ValidationResult(true, 0, 0, "");
        }
        catch (ParseErrorException e)
        {
            return new ValidationResult(false, e.Error.LineNumber, e.Error.Column, e.Error.Description ?? e.Message);
        }
    }
}
